import React from 'react';

class CodeRunWindow extends React.Component {

  constructor () {
    super();

    //iframe ref
    this.iframe = React.createRef();
  }

  refreshIframe () {
    this.iframe.current.src = this.iframe.current.src;
  }

  render () {
    return <div className='codeRunnerPanel'>
      <div className="codeEditorTopBar" onClick={() => {
        this.refreshIframe();
      }}>
        <button><span className="material-symbols-outlined">refresh</span> Refresh Client</button>
      </div>
      <iframe ref={this.iframe} src="./code" style={{flex:1}}></iframe>
    </div>
  }

}

export default CodeRunWindow;