import React from 'react';
import {render, Box, AppContext} from '../../src';

class Test extends React.Component<
	{onExit: (error: Error) => void},
	{counter: number}
> {
	timer?: NodeJS.Timeout;

	state = {
		counter: 0
	};

	render() {
		return <Box>Counter: {this.state.counter}</Box>;
	}

	componentDidMount() {
		setTimeout(this.props.onExit, 500);

		this.timer = setInterval(() => {
			this.setState(prevState => ({
				counter: prevState.counter + 1
			}));
		}, 100);
	}

	componentWillUnmount() {
		clearInterval(this.timer!);
	}
}

const app = render(
	<AppContext.Consumer>
		{({exit}) => <Test onExit={exit} />}
	</AppContext.Consumer>
);

app.waitUntilExit().then(() => console.log('exited'));
