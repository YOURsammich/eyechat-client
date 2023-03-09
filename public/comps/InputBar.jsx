import * as React from 'react';
import handleInput from './../../utils/handleInput'

class InputBar extends React.Component {
  constructor () {
    super();
  }

  handleInput (event) {
    const target = event.target;

    if (event.which == 13) {

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

  render () {
    return <div className="input-container" onKeyDown={this.handleInput.bind(this)}>
      <input placeholder="Type anything then press enter." />
    </div>
  }
}

export default InputBar;