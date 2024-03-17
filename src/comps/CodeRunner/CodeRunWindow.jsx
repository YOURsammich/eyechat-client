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
    if (!this.props.focusOnCode) return null;

    return <div className='codeRunnerPanel' style={{pointerEvents: this.props.draggingWindow ? 'none' : ''}}>
      <iframe ref={this.iframe} src={"./code/" + this.props.pluginName} style={{flex:1}}></iframe>
    </div>
  }

}

export default CodeRunWindow;