import React, {ReactNode} from 'react';
import throttle from 'lodash.throttle';
import logUpdate, {LogUpdate} from 'log-update';
import ansiEscapes from 'ansi-escapes';
import originalIsCI from 'is-ci';
import autoBind from 'auto-bind';
import {reconciler} from './reconciler';
import {createRenderer, Renderer} from './renderer';
import signalExit from 'signal-exit';
import * as dom from './dom';
import {FiberRoot} from 'react-reconciler';
import {instances} from './instances';
import {App} from './components/App';

const isCI = process.env.CI === 'false' ? false : originalIsCI;

export interface Options {
	stdout: NodeJS.WriteStream;
	stdin: NodeJS.ReadStream;
	debug: boolean;
	exitOnCtrlC: boolean;
	waitUntilExit?: () => Promise<void>;
}

export class Ink {
	private readonly options: Options;
	private readonly log: LogUpdate;
	private readonly throttledLog: LogUpdate;
	// Ignore last render after unmounting a tree to prevent empty output before exit
	private isUnmounted: boolean;
	private lastOutput: string;
	private readonly container: FiberRoot;
	private readonly rootNode: dom.DOMElement;
	// This variable is used only in debug mode to store full static output
	// so that it's rerendered every time, not just new static parts, like in non-debug mode
	private fullStaticOutput: string;
	private readonly renderer: Renderer;
	private readonly exitPromise: Promise<void>;

	constructor(options: Options) {
		autoBind(this);

		this.options = options;
		this.rootNode = dom.createNode('root');

		this.rootNode.onRender = options.debug
			? this.onRender
			: throttle(this.onRender, 32, {
					leading: true,
					trailing: true
			  });

		this.rootNode.onImmediateRender = this.onRender;

		this.renderer = createRenderer({
			terminalWidth: options.stdout.columns
		});

		this.log = logUpdate.create(options.stdout);
		this.throttledLog = options.debug
			? this.log
			: throttle(this.log, undefined, {
					leading: true,
					trailing: true
			  });

		// Ignore last render after unmounting a tree to prevent empty output before exit
		this.isUnmounted = false;

		// Store last output to only rerender when needed
		this.lastOutput = '';

		// This variable is used only in debug mode to store full static output
		// so that it's rerendered every time, not just new static parts, like in non-debug mode
		this.fullStaticOutput = '';

		this.container = reconciler.createContainer(this.rootNode, false, false);

		this.exitPromise = new Promise((resolve, reject) => {
			this.resolveExitPromise = resolve;
			this.rejectExitPromise = reject;
		});

		// Unmount when process exits
		this.unsubscribeExit = signalExit(this.unmount, {alwaysLast: false});
	}

	resolveExitPromise: () => void = () => {};
	rejectExitPromise: (reason?: Error) => void = () => {};
	unsubscribeExit: () => void = () => {};

	onRender: () => void = () => {
		if (this.isUnmounted) {
			return;
		}

		const {output, outputHeight, staticOutput} = this.renderer(this.rootNode);

		// If <Static> output isn't empty, it means new children have been added to it
		const hasStaticOutput = staticOutput && staticOutput !== '\n';

		if (this.options.debug) {
			if (hasStaticOutput) {
				this.fullStaticOutput += staticOutput;
			}

			this.options.stdout.write(this.fullStaticOutput + output);
			return;
		}

		if (isCI) {
			if (hasStaticOutput) {
				this.options.stdout.write(staticOutput);
			}

			this.lastOutput = output;
			return;
		}

		if (hasStaticOutput) {
			this.fullStaticOutput += staticOutput;
		}

		if (outputHeight >= this.options.stdout.rows) {
			this.options.stdout.write(
				ansiEscapes.clearTerminal + this.fullStaticOutput + output
			);
			this.lastOutput = output;
			return;
		}

		// To ensure static output is cleanly rendered before main output, clear main output first
		if (hasStaticOutput) {
			this.log.clear();
			this.options.stdout.write(staticOutput);
		}

		if (output !== this.lastOutput) {
			this.throttledLog(output);
		}
	};

	render(node: ReactNode): void {
		const tree = (
			<App
				stdin={this.options.stdin}
				stdout={this.options.stdout}
				exitOnCtrlC={this.options.exitOnCtrlC}
				onExit={this.unmount}
			>
				{node}
			</App>
		);

		reconciler.updateContainer(tree, this.container);
	}

	unmount(error?: Error | number | null): void {
		if (this.isUnmounted) {
			return;
		}

		this.onRender();
		this.unsubscribeExit();

		// CIs don't handle erasing ansi escapes well, so it's better to
		// only render last frame of non-static output
		if (isCI) {
			this.options.stdout.write(this.lastOutput + '\n');
		} else if (!this.options.debug) {
			this.log.done();
		}

		this.isUnmounted = true;

		reconciler.updateContainer(null, this.container);
		instances.delete(this.options.stdout);

		if (error instanceof Error) {
			this.rejectExitPromise(error);
		} else {
			this.resolveExitPromise();
		}
	}

	waitUntilExit(): Promise<void> {
		return this.exitPromise;
	}
}
