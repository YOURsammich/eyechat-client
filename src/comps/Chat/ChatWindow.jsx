import react from 'react';

import Messages from './Messages';
import InputBar from './InputBar';

class ChatWindow extends React.Component {
  
  constructor () {
    super();
  }

  getUserFlair (nick) {
    const user = this.props.userlist.find(a=> a.nick == nick);
    return user ? user.flairColor : '';
  }

  render () {

    return <div className='chatContainer'>

      <div style={{
        backgroundColor: '#111',
        color: '#fff',
        padding: '10px',
      }}>
        #main
      </div>

      <Messages 
        socket={this.props.socket}
        getUserFlair={this.getUserFlair.bind(this)}
      />
      <InputBar 
        socket={this.props.socket}
      />

    </div>

  }

}

export default ChatWindow;