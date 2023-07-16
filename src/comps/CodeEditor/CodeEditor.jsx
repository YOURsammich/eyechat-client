import * as React from 'react'
import CodeMirrorEditor from './CodeMirrorWrapper';

class EditorHomePage extends React.Component {

  constructor() {
    super();

    this.state = {
      nav: 'myPlugins'
    }

    this.navData = {
      categories: [{
        name: 'My Plugins',
        id: 'myPlugins'

      }, {
        name: 'Collabs',
        id: 'collabs'
      }]
    }

    this.panels = {
      myPlugins: this.renderList,
      newPlugin: this.renderNewPlugin
    }

  }

  renderNewPlugin (props) {
    return <form className='newPluginForm' onSubmit={(e) => {
      e.preventDefault();
      props.newPlugin();
    }}>
      <label>
        <h3>Plugin Name</h3>
        <input className='pluginFormInput' type="text" name="pluginname" placeholder='Plugin Name' />
      </label>

      <label>
        <h3>Plugin Description</h3>
        <textarea className='pluginFormInput' type="text" rows="5" cols="33" placeholder='Plugin Description (optional)'></textarea>
      </label>

      <button type="submit">Start Editor</button>
    </form>
  }

  renderList (props) {
    return <div className='pluginList'>
      {props.plugins && props.plugins.map((plugin, i) => {
        return <div className='plugin' key={i} onClick={() => {
          props.selectPlugin(plugin.name)
        }}>
          <div className='pluginName'>{plugin.name}</div>
        </div>
      })}
    </div>
  }

  render() {
    return <div className="codeEditorContainer">
      <div className="editorHome">
        <div className='editorHomeNav'>{
          this.navData.categories.map((category, i) => {
            return <div className="editorHomeNavCategoryHeader" key={i} style={{
              color: this.state.nav === category.id ? 'white' : '',
            }} onClick={() => this.setState({nav: category.id})}>{category.name}</div>
          })
        }

          <div style={{flex:1}}></div>

          <div className="editorHomeNavCategoryHeader" style={{
            gap: '5px', color: this.state.nav === 'newPlugin' ? 'white' : '',
          }} onClick={() => {
            this.setState({nav: 'newPlugin'})
          }}>
            <span className="material-symbols-outlined">add</span>
            New Plugin
          </div>
        </div>

        <hr className="lineBreak" />

        <div className='edtiorHomeContent'>
          {this.panels[this.state.nav](this.props)}
        </div>

      </div>

    </div>
  }

}

function EditorContainer (props) {
  const [isSaving, setSaving] = React.useState(false);
  const [listShown, setListShown] = React.useState(false);

  React.useEffect(() => {
    if (isSaving) {
      fetch('./savePlugin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(props.plugin)
      })
        .then(data => {
          setSaving(false);
          setSaveTime(Date.now());
        });
    }

  }, [isSaving]);
  
  return <div className="codeEditorContainer">
    
    <div style={{display:'flex', flex: 1, flexDirection:'column'}}>
      
      <div className="editorTopBar">

        <div style={{display:'flex',gap:'15px', paddingLeft: '20px'}}>

          <button className='backToHome' style={{cursor: 'pointer',textAlign: 'center'}}
            onClick={() => props.setView('home')}
          >
            <span className="material-symbols-outlined">home</span>
          </button>
          
          <button className='backToHome' style={{cursor: 'pointer',textAlign: 'center'}}
            onClick={() => setListShown(!listShown)}
          >
            <span className="material-symbols-outlined">list</span>
          </button>
        </div>

        <h3 style={{textAlign: 'center'}}>{props.plugin.name}</h3>

        {isSaving && <div>SAVING</div>}

        <button className="stdBtn" onClick={() => {
          setSaving(true);
        }}>
          <span className="material-symbols-outlined">play_arrow</span>
          Start Server
        </button>

      </div>

      {
        listShown ? <div className='pluginControlPanel'>
          {/* return to home page */}
          <button className='savePlugin'>CLIENT</button>
          <button className='savePlugin'>SERVER</button>
        </div> : null 
      }

      <CodeMirrorEditor 
        socket={props.socket}
        plugin={props.plugin}
      />
    </div>
  </div>;
}

class CodeEditor extends React.Component {
  constructor() {
    super();

    this.state = {
      plugin: {
        name: 'test',
        code: 'console.log("test")'
      },
      view: 'home',
    }

    this.views = {
      home: EditorHomePage,
      editor: EditorContainer
    }

  }

  componentDidMount() {

    fetch('./plugins')
      .then(res => res.json())
      .then(data => {
        this.setState({
          plugins: data
        })

      });

  }

  selectPlugin (pluginName) {
    this.setState({
      plugin: { name: pluginName },
      view: 'editor'
    });

  }
  
  newPlugin () {
    this.setState({
      plugin: {
        name: 'newPlugin',
        code: 'console.log("new plugin")'
      },
      view: 'editor'
    })
  }

  render() {
    const View = this.views[this.state.view]

    return <View 
      socket={this.props.socket}
      plugin={this.state.plugin}
      plugins={this.state.plugins}
      selectPlugin={this.selectPlugin.bind(this)}
      newPlugin={this.newPlugin.bind(this)}
      setView={(view) => this.setState({view: view})}
    />
  }
}

export default CodeEditor;