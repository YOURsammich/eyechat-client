import * as React from 'react'
import CodeMirrorEditor from './CodeMirrorWrapper';

class CodeEditor extends React.Component {
  constructor() {
    super();

    this.state = {
      plugin: {
        name: 'test',
        code: 'console.log("test")'
      }
    }

  }

  componentDidMount() {

    fetch('./plugin')
      .then(res => res.json())
      .then(data => {
        console.log(data);

        this.setState({
          plugins: data
        })

      });

  }

  getPluginCode (pluginName) {
    fetch('./pluginCode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({pluginName: pluginName})
    })
      .then(res => res.json())
      .then(data => {

        const pasedCode = JSON.parse(data.clientcode);

        this.setState({
          plugin: {
            name: pluginName,
            code: pasedCode.init
          }
        })


      });
  }

  render() {
    return <div className="codeEditorContainer">

      <div className='pluginList'>
        {this.state.plugins && this.state.plugins.map((plugin, i) => {
          return <div className='plugin' key={i} onClick={() => {
            this.getPluginCode(plugin.name)
          }}>
            <div className='pluginName'>{plugin.name}</div>
          </div>
        })}
      </div>

      <CodeMirrorEditor 
        socket={this.props.socket}
        plugin={this.state.plugin}
      />

    </div>;
  }
}

export default CodeEditor;