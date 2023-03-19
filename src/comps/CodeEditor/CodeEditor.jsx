import * as React from 'react'
import CodeMirrorEditor from './CodeMirrorWrapper';

class CodeEditor extends React.Component {
  constructor() {
    super();

    this.state = {
      code: ''
    }

  }

  render() {
    return <div className="codeEditorContainer">

      <CodeMirrorEditor 
        socket={this.props.socket}
        value={this.state.code}
      />

    </div>;
  }
}

export default CodeEditor;