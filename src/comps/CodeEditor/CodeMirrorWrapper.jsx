import React, { useEffect, useRef, useState  } from "react";
import { EditorView, ViewPlugin, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState, ChangeSet, Text } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { collab, sendableUpdates, getSyncedVersion, receiveUpdates } from "@codemirror/collab";
//import history from commands
import { history } from "@codemirror/commands";

async function pushUpdates(version, fullUpdates, plugin) {

  const updates = fullUpdates.map(u => ({
    changes: u.changes.toJSON(),
    clientID: u.clientID
  }))
  
  return fetch('/pushUpdates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      },
      body: JSON.stringify({version, updates, plugin: plugin.name})
    });

}

async function pullUpdates(version, plugin) {
  return fetch('/pullUpdates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      },
      body: JSON.stringify({version, plugin: plugin.name})
    })
    .then(res => res.json())
    .then(data => {
      console.log('pulled', plugin.name)
      //if there are no updates, return
      if (!data) return []

      const updates = data.map(u => ({
        changes: ChangeSet.fromJSON(u.changes),
        clientID: u.clientID
      }))
      return updates
    });
}

async function getDocument(plugin) {
  return fetch('/getDocument')
    .then(res => res.json())
    .then(data => ({
      version: data.version,
      doc: Text.of(data.doc.split("\n"))
    }))
}

function peerExtensionSocket(startVersion, plugin, getCurrPlugin, socket) {

  let colabPlugun = ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.pushing = false
      this.pulling = false;
      this.done = false
      
      socket.on('codePull', (data) => {
        console.log('pulled socket', plugin.name, data)
        const version = getSyncedVersion(this.view.state)
        const updates = data.updates.map(u => ({
          changes: ChangeSet.fromJSON(u.changes),
          clientID: u.clientID
        }));
        this.view.dispatch(receiveUpdates(this.view.state, updates))

      });
     }

    update(update) {
      if (update.docChanged) this.push()
    }

    push () {
      let updates = sendableUpdates(this.view.state)
      if (this.pushing || !updates.length) return
      this.pushing = true
      let version = getSyncedVersion(this.view.state)
      socket.emit('codePush', {
        version,
        updates,
        plugin: plugin.name
      })
      console.log('pushed socket', plugin.name, version)
      this.pushing = false
      // Regardless of whether the push failed or new updates came in
      // while it was running, try again if there's updates remaining
      if (sendableUpdates(this.view.state).length) {
        setTimeout(() => this.push(), 100)
      }
    }

    destroy() {
      this.done = true
     }

  })

  return [collab({startVersion}), colabPlugun]

}

function peerExtension(startVersion, plugin, getCurrPlugin) {
  let colabPlugun = ViewPlugin.fromClass(class {
    constructor(view) { 
      this.view = view;
      this.pushing = false
      this.pulling = false;
      this.done = false
      this.pull()
     }

    update(update) {
      if (update.docChanged) this.push()
    }

    async push() {
      let updates = sendableUpdates(this.view.state)
      if (this.pushing || !updates.length) return
      this.pushing = true
      let version = getSyncedVersion(this.view.state)
      await pushUpdates(version, updates, plugin)
      console.log('pushed', plugin.name, version)
      this.pushing = false
      // Regardless of whether the push failed or new updates came in
      // while it was running, try again if there's updates remaining
      if (sendableUpdates(this.view.state).length) {
        console.log(sendableUpdates(this.view.state))
        setTimeout(() => this.push(), 100)
      }
    }

    async pull() {
      const loopId = Math.random();
      while (plugin.name === getCurrPlugin().name && !this.done) {
        console.log(loopId)
        let version = getSyncedVersion(this.view.state)
        let updates = await pullUpdates(version, plugin)
        this.view.dispatch(receiveUpdates(this.view.state, updates))
      }
    }

    destroy() { 
      this.done = true
     }
  })
  return [collab({startVersion}), colabPlugun]
}

async function createPeerState(plugin, getCurrPlugin, socket) {
  console.log(socket);
  let {version, doc} = await getDocument(plugin);
  let state = EditorState.create({
    doc,
    extensions: [
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      lineNumbers(),
      javascript(),
      oneDark,
      peerExtensionSocket(version, plugin, getCurrPlugin, socket)
    ]
  })
  return state;
}

const CodeMirrorEditor = ({socket, value, plugin }) => {
  const editorRef = useRef();
  const [editorView, setEditorView] = useState();
  const [currPlugin, setCurrPlugin] = useState(plugin);
  
  useEffect(() => {
    if (editorView) {
      if (editorView.then) return;

      if (plugin.name !== currPlugin.name) {
        setCurrPlugin(plugin);
      }
      
      return;
    }

    let view = true;
    createPeerState(plugin, () => plugin, socket).then(state => {
      view = new EditorView({state, parent: editorRef.current});
      setEditorView(view);
    });

    setEditorView(view);

    return () => {
      if (editorView) {
        view.destroy();
        setEditorView(null);
      }
    }
  });

  return <div ref={editorRef} className="codemirror-editor" />;
};

export default CodeMirrorEditor;