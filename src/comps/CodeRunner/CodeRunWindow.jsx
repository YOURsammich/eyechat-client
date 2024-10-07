import React from 'react';

class CodeRunWindow extends React.Component {

  constructor () {
    super();

    this.resizeBarRef = React.createRef();

    //iframe ref
    this.iframe = React.createRef();

    this.state = {
      draggingWindow: false
    }

  }

  componentDidMount () {
    this.props.giveRefresh(this.refreshIframe.bind(this));
    this.scrollListenerInit();
  }

  scrollListenerInit() {
    this.resizeBarRef.current.addEventListener('mousedown', (e) => {
      e.preventDefault();

      const resizeBar = this.resizeBarRef.current.parentElement;
      const container = resizeBar.parentElement;

      this.diff = container.offsetWidth - e.clientX;

      this.setState({draggingWindow: true});
    });

    document.addEventListener('mousemove', (e) => {
      if (this.state.draggingWindow) {
        this.setState({ chatWidth: (e.clientX + this.diff) });
      }
    });

    document.addEventListener('mouseup', (e) => {

      this.setState({draggingWindow: false});
    });

  }

  refreshIframe () {
    this.iframe.current.src = this.iframe.current.src;
  }

  render () {

    return <div style={{
      display: 'flex',
      width: this.state.chatWidth + 'px',
    }}>
      <div className='codeRunnerPanel' style={{pointerEvents: this.props.draggingWindow ? 'none' : ''}}>
        <iframe ref={this.iframe} src={"http://localhost:8080/v/sammich/" + this.props.pluginName} style={{
          flex:1, border: 'none', pointerEvents: (this.state.draggingWindow ? 'none' : '')
        }}></iframe>
      </div>

      <div className='resizeBar'>
        <div className='resizeHandle' ref={this.resizeBarRef}>
          <span className="material-symbols-outlined">width</span>
        </div>
      </div>

    </div>
  }

}

export default CodeRunWindow;