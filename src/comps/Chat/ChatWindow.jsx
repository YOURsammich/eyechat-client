import react from 'react';

import Messages from './Messages';
import InputBar from './InputBar';

class ChatWindow extends React.Component {
  
  constructor () {
    super();
  }

  render () {

    return <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '500px',
      overflowY: 'hidden',
    }}>

      <Messages 
        socket={this.props.socket}
      />
      <InputBar 
        socket={this.props.socket}
      />

    </div>

  }

}

export default ChatWindow;