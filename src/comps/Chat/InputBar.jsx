import * as React from 'react';
import handleInput from '../../utils/handleInput'

class InputBar extends React.Component {
  constructor () {
    super();
  }

  handleInput (event) {
    const target = event.target;

    if (event.which == 13) {
      event.preventDefault();
      try {
        const inputData = handleInput.handle(target.value);

        if (inputData.commandName) {
          this.props.socket.emit('command', inputData);
        } else {
          this.props.socket.emit('message', inputData);
        }

        target.value = '';
      } catch (e) {
        console.log(e);
      }

    }
  }

  handleKeyUp (event) {
    const target = event.target;

    if (event.which == 13) {
      target.value = '';
    }
  }

  render () {
    return <div className="input-container" onKeyDown={this.handleInput.bind(this)} onKeyUp={this.handleKeyUp.bind(this)}>
      <textarea rows="1" placeholder="Type anything then press enter."></textarea>
    </div>
  }
}

export default InputBar;