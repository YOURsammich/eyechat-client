import React, { useEffect, useRef, useState  } from "react";
import { EditorView, ViewPlugin, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState, ChangeSet, Text, StateField } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { collab, sendableUpdates, getSyncedVersion, receiveUpdates } from "@codemirror/collab";

import {basicSetup} from "codemirror"

//import history from commands
import { history, historyField } from "@codemirror/commands";

async function getDocument(plugin) {
  return fetch('/getDocument', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({plugin: plugin})
  })
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
      this.pushing = false;
      this.done = false;
      
      this.removeEvent = socket.on('codePull', (data) => {
        if (plugin.name != data.plugin) return;
        //console.log('pulled socket', plugin.name, data);
        //const version = getSyncedVersion(this.view.state)
        const updates = data.updates.map(u => ({
          changes: ChangeSet.fromJSON(u.changes),
          clientID: u.clientID
        }));

        this.view.dispatch(receiveUpdates(this.view.state, updates))
        this.pushing = false
      });

      // console.log('requesting updates', getSyncedVersion(this.view.state))
      // socket.emit('pullUpdates', {
      //   plugin: plugin.name,
      //   version: getSyncedVersion(this.view.state)
      // })

     }

    update(update) {
      if (update.docChanged) this.push()
    }

    push () {
      let updates = sendableUpdates(this.view.state);
      if (this.pushing || !updates.length) return
      this.pushing = true
      let version = getSyncedVersion(this.view.state);
        
      console.log('pushed socket', plugin.name, version)

      socket.emit('codePush', {
        version,
        updates: updates.map(u=>({
          changes: u.changes.toJSON(),
          clientID: u.clientID
        })),
        plugin: plugin.name
      });

      // Regardless of whether the push failed or new updates came in
      // while it was running, try again if there's updates remaining
      if (sendableUpdates(this.view.state).length) {
        setTimeout(() => this.push(), 100);
      }
    }

    destroy() {
      this.removeEvent();
      this.done = true
     }

  })

  return [collab({startVersion}), colabPlugun]

}

async function createPeerState(plugin, getCurrPlugin, socket) {
  let {version, doc} = await getDocument(plugin);
  console.log(doc);
  let state = EditorState.create({
    doc,
    extensions: [
      highlightActiveLine(),
      highlightActiveLineGutter(),
      basicSetup,
      peerExtensionSocket(version, plugin, getCurrPlugin, socket),
      // history(),
      // ViewPlugin.fromClass(class {
      //   constructor(view) {
        
      //   }

      //   update(update) {
      //     console.log('update', update.state.toJSON({history: historyField}));
      //   }

      // }),
      // lineNumbers(),
      javascript(),
      oneDark
    ]
  })
  return state;
}

const codemirrorstates = {};

const CodeMirrorEditor = ({socket, value, plugin }) => {
  const editorRef = useRef();
  const [editorView, setEditorView] = useState();
  const [currPlugin, setCurrPlugin] = useState(plugin);
  
  useEffect(() => {
    if (editorView) {
      if (editorView.then) return;

      if (plugin.name !== currPlugin.name) {

        if (false && codemirrorstates[plugin.name]) {
          console.log('cached')
          editorView.setState(codemirrorstates[plugin.name]);
        } else {
          console.log('not cached')
          createPeerState(plugin, () => plugin, socket).then(state => {
            codemirrorstates[plugin.name] = state;
            editorView.setState(state);

          });
        }



        setCurrPlugin(plugin);
      }
      
      return;
    }

    let view = true;
    createPeerState(plugin, () => plugin, socket).then(state => {
      window.view = view = new EditorView({state, parent: editorRef.current});

      codemirrorstates[plugin.name] = state;

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