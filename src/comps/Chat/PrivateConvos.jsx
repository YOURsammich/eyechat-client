import * as React from 'react';
import socket from '../../utils/socket';

class PrivateConvo extends React.Component {
	constructor() {
		super();

		this.state = {
			showConvos: false,
			selectedConvo: null
		};

		this.handleScroll = this.handleScroll.bind(this);
	}

	componentDidMount() {
	}

	componentDidUpdate() {
		if (this.convoDetailsRef) {
			this.convoDetailsRef.scrollTop = this.convoDetailsRef.scrollHeight;
		}
	}

	handleScroll = (convo) => (event) => {
		if (this.convoDetailsRef && this.convoDetailsRef.scrollTop === 0) {
			const offset = convo.messages.length ?? 0;
			this.props.socket.emit('pmRequest', {convoid: convo.convoid, offset: offset})
		}
	};

	selectConvo = (convo) => {
		const offset = convo.messages?.length ?? 0;
		this.props.socket.emit('pmRequest', {convoid: convo.convoid, offset: offset})
		this.setState({ selectedConvo: convo.convoid });
	}

	render() {
		const currentConvo = this.props.findConvo(this.state.selectedConvo);
		const participants = (convo) => {
			const nick = this.props.getMyNick();
			const convoWith = convo.participant1 === nick ? convo.participant2 : convo.participant1;
			return { with: convoWith, me: nick }
		}
		return (
			<div className='convosContainer'>

				<div className='convoHeader'>

					{this.state.selectedConvo
						? <button className='goBack material-symbols-outlined' onClick={() => this.setState({ selectedConvo: null })}>chevron_left</button>
						: null}

					{this.state.selectedConvo
						? <h3>{`Convo with ${participants(currentConvo).with}`}</h3>
						: <h3>Your Conversations</h3>}

					{this.state.selectedConvo
						? null
						: <button className='newConvo material-symbols-outlined' onClick={() => console.log('Use /pm user msg bruh')}>chat_add_on</button>}

				</div>

				{this.state.selectedConvo ? (
					<div className='pmBody'>

						<div className='convoDetails' ref={(el) => { this.convoDetailsRef = el; }} onScroll={this.handleScroll(currentConvo)}>
							{currentConvo.messages?.map((message, index) => (
								<div
									key={index}
									className={`convoMessage ${message.sender === participants(currentConvo).me ? 'alignLeft' : 'alignRight'}`}
								>
									{message.time_sent.hhmm} / {message.receiver}: {message.msg}
								</div>
							))}
						</div>

						<PmInput
							socket={this.props.socket}
							convoWith={participants(currentConvo).with}
						/>
					</div>
				) : (
					this.props.conversationList.map((convo, index) => {
						return (
							<div
								key={index}
								className='convoBanner'
								onClick={() => this.selectConvo(convo)}>
								<span>{participants(convo).with}</span>
							</div>
						);
					})
				)}

			</div>
		);
	}
}

class PmInput extends React.Component {
	constructor() {
		super();

		this.state = {
			convoWith: null
		}

		this.submitValue = this.submitValue.bind(this)
	}

	componentDidMount() {
		this.setState({ convoWith: this.props.convoWith })
	}

	submitValue(event) {
		const comm = { to: this.state.convoWith, message: event.target.value }

		if (event.code === 'Enter') {
			this.props.socket.emit('pmSend', comm)
			event.target.value = null;
		}
	}

	render() {
		return (
			<div className='pmInputBanner'>

				<input
					type='text'
					className='pmInputBar'
					onKeyDown={this.submitValue}
					placeholder='Enter message here...' >
				</input>

			</div>
		)
	}
}



export default PrivateConvo;
