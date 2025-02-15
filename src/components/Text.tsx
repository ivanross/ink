import React, {FC, ReactNode} from 'react';
import PropTypes from 'prop-types';
import chalk from 'chalk';

export interface TextProps {
	readonly bold?: boolean;
	readonly italic?: boolean;
	readonly underline?: boolean;
	readonly strikethrough?: boolean;
	readonly unstable__transformChildren?: (children: ReactNode) => ReactNode;
	readonly children: ReactNode;
}

/**
 * This component can change the style of the text, make it bold, underline, italic or strikethrough.
 */
export const Text: FC<TextProps> = ({
	bold,
	italic,
	underline,
	strikethrough,
	children,
	unstable__transformChildren
}) => {
	const transformChildren = (children: ReactNode) => {
		if (bold) {
			children = chalk.bold(children);
		}

		if (italic) {
			children = chalk.italic(children);
		}

		if (underline) {
			children = chalk.underline(children);
		}

		if (strikethrough) {
			children = chalk.strikethrough(children);
		}

		if (unstable__transformChildren) {
			children = unstable__transformChildren(children);
		}

		return children;
	};

	return (
		<span
			style={{flexDirection: 'row'}}
			// @ts-ignore
			unstable__transformChildren={transformChildren}
		>
			{children}
		</span>
	);
};

/* eslint-disable react/boolean-prop-naming */
Text.propTypes = {
	bold: PropTypes.bool,
	italic: PropTypes.bool,
	underline: PropTypes.bool,
	strikethrough: PropTypes.bool,
	children: PropTypes.node.isRequired,
	unstable__transformChildren: PropTypes.func
};
/* eslint-enable react/boolean-prop-naming */

Text.defaultProps = {
	bold: false,
	italic: false,
	underline: false,
	strikethrough: false,
	unstable__transformChildren: undefined
};
