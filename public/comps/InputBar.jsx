import * as React from 'react';
import handleInput from './../../utils/handleInput'

class InputBar extends React.Component {
  constructor () {
    super();
  }

  handleInput (event) {
    const target = event.target;

    if (event.which == 13) {

      handleInput.handle(target.value);
      //this.props.socket.emit('message', target.value);
      target.value = '';
    }
  }

  render () {
    return <div className="input-container" onKeyDown={this.handleInput.bind(this)}>
      <input placeholder="Type anything then press enter." />
    </div>
  }
}

export default InputBar;