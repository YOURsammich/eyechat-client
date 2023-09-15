import * as React from 'react';
import socket from '../../utils/socket';

class PrivateConvo extends React.Component {
	constructor() {
		super();

		this.state = {
			selectedConvo: null,
      conversationList: []
		};

		this.handleScroll = this.handleScroll.bind(this);
    this.findConvo = this.findConvo.bind(this);
	}

	componentDidMount() {
		const socket = this.props.socket;

		socket.on('pmConvos', (convos) => {
			let oldConvos = this.state.conversationList;

			convos.forEach(convo => {
				oldConvos.push(convo);
			});

			this.setState({ conversationList: oldConvos });
		})

		socket.on('pmMessage', (messages) => {
			const { conversationList } = this.state;
			const updatedConvoId = messages[0].convoid;

			messages.forEach((message) => {
				const timeString = message.time_sent;
				const newTime = this.parseTimeString(timeString)
				message.time_sent = newTime;
			})

			const updatedConvos = conversationList.map(convo => {
				if (convo.convoid === updatedConvoId) {
					const updatedMessages = convo.messages ? [...convo.messages, ...messages] : messages;
					updatedMessages.sort((a, b) => a.messageid - b.messageid);
					return {
						...convo,
						messages: updatedMessages,
					};
				}
				return convo;
			});
			console.log(updatedConvos)
			this.setState({ conversationList: updatedConvos }, () => {
				console.log(this.state.conversationList)
			});
		});
	}

	componentDidUpdate() {
		if (this.convoDetailsRef) {
			this.convoDetailsRef.scrollTop = this.convoDetailsRef.scrollHeight;
		}
	}

	toggle(prop) {
		this.setState( prevState => ({ [prop]: !prevState[prop] }))
	}

	handleScroll = (convo) => (event) => {
		if (this.convoDetailsRef && this.convoDetailsRef.scrollTop === 0) {
			const offset = convo.messages.length ?? 0;
			this.props.socket.emit('pmRequest', { convoid: convo.convoid, offset: offset })
		}
	};

	parseTimeString(timeString) {
    const date = new Date(timeString);

    const optionsForDate = { year: 'numeric', month: 'numeric', day: 'numeric' };
    const optionsForTime = { hour: '2-digit', minute: '2-digit', hour12: true };

    const datePart = date.toLocaleDateString(undefined, optionsForDate);
    const timePart = date.toLocaleTimeString(undefined, optionsForTime);

    return {
      date: datePart,
      hhmm: timePart,
    };
  };

  findConvo(convoid) {
    const index = this.state.conversationList.findIndex((convo) => convo.convoid === convoid)
    return this.state.conversationList[index]
  }

	selectConvo = (convo) => {
		const offset = convo.messages?.length ?? 0;
		console.log(offset)
		offset <= 0 ? this.props.socket.emit('pmRequest', { convoid: convo.convoid, offset: offset }) : null
		console.log('offset', offset)
		this.setState({ selectedConvo: convo.convoid });
	}

	render() {
		const currentConvo = this.findConvo(this.state.selectedConvo);
		const participants = (convo) => {
			const nick = this.props.getMyNick();
			const convoWith = convo.participant1 === nick ? convo.participant2 : convo.participant1;
			return { with: convoWith, me: nick }
		}
		return (
			<div className='convosContainer'>

				<div className='convoHeader'>

					{this.state.selectedConvo
						? <button className='hoverMask convoHeaderButtons material-symbols-outlined' style={{ left: '5px' }} onClick={() => this.setState({ selectedConvo: null })}>chevron_left</button>
						: null}

					{this.state.selectedConvo
						? <h3>{`Convo with ${participants(currentConvo).with}`}</h3>
						: <h3>Your Conversations</h3>}

					{this.state.selectedConvo
						? null
						: <button style={{ right: '5px' }} className='convoHeaderButtons hoverMask material-symbols-outlined' onClick={() => console.log('/pm user message for now')}>chat_add_on</button>}

				</div>

				{this.state.selectedConvo ? (
					<div className='pmBody'>

						<div className='convoDetails' ref={(el) => { this.convoDetailsRef = el; }} onScroll={this.handleScroll(currentConvo)}>
							{currentConvo.messages?.map((message, index) => (
								<div
									key={index}
									className={`convoMessage ${message.sender === participants(currentConvo).me ? 'receiever' : 'sender'}`}
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
					<div className='convoContainer'>
						{this.state.newConvo && (
							<div className='newConvoContainer'>
								<input type='text' placeholder='Search for users...' />
							</div>
						)}
						{this.state.conversationList.map((convo, index) => (
							<div key={index} className='convoBanner'>
								<div
									className='hoverMask convoBanner'
									onClick={() => this.selectConvo(convo)}
								>
									<span>{participants(convo).with}</span>
									<span className='messagePreview'> {convo.last_message} </span> 
								</div>
							</div>
						))}
					</div>
				)}

			</div>
		)
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
