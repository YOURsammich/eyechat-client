import React from 'react';

class CodeRunWindow extends React.Component {

  constructor () {
    super();

    //iframe ref
    this.iframe = React.createRef();
  }

  componentDidMount () {
    this.props.giveRefresh(this.refreshIframe.bind(this));
  }

  refreshIframe () {
    this.iframe.current.src = this.iframe.current.src;
  }

  render () {

    return <div className='codeRunnerPanel' style={{pointerEvents: this.props.draggingWindow ? 'none' : ''}}>
      <iframe ref={this.iframe} src={"http://mentalmeat.cloud:8080/v/sammich/" + this.props.pluginName} style={{flex:1, border: 'none'}}></iframe>
    </div>
  }

}

export default CodeRunWindow;