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

      {/* <div className="chatHeader">
        <span className="material-symbols-outlined" onClick={()=> this.props.toggleEditor()}>code</span>
      </div> */}

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