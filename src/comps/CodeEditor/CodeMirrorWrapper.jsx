import React, { useEffect, useRef, useState  } from "react";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { EditorState, ChangeSet, Text } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { collab, sendableUpdates, getSyncedVersion, receiveUpdates } from "@codemirror/collab";


async function pushUpdates(connection, version, fullUpdates){

  const updates = fullUpdates.map(u => ({
    changes: u.changes.toJSON(),
    clientID: u.clientID
  }))

  return fetch('/pushUpdates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      },
      body: JSON.stringify({version, updates})
    });

}

async function pullUpdates(connection, version) {
  return fetch('/pullUpdates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      },
      body: JSON.stringify({version})
    })
    .then(res => res.json())
    .then(data => {
      //if there are no updates, return
      if (!data) return []

      const updates = data.map(u => ({
        changes: ChangeSet.fromJSON(u.changes),
        clientID: u.clientID
      }))
      return updates
    });
}

async function getDocument() {
  return fetch('/getDocument')
    .then(res => res.json())
    .then(data => ({
      version: data.version,
      doc: Text.of(data.doc.split("\n"))
    }))
}

function peerExtension(startVersion, connection) {
  let plugin = ViewPlugin.fromClass(class {
    constructor(view) { 
      this.view = view;
      this.pushing = false
      this.pulling = false;
      this.done = false
      this.pull()

      // connection.on('pullUpdates', (data) => {
      //   console.log('pullUpdates', data);
      //   this.pulling = false;
      //   //this.pushing = false
      //   const updates = data.map(u => ({
      //     changes: ChangeSet.fromJSON(u.changes),
      //     clientID: u.clientID
      //   }))

      //   this.view.dispatch(receiveUpdates(this.view.state, updates))
      // });

     }

    update(update) {
      if (update.docChanged) this.push()
    }

    async push() {
      let updates = sendableUpdates(this.view.state)
      if (this.pushing || !updates.length) return
      this.pushing = true
      let version = getSyncedVersion(this.view.state)
      await pushUpdates(connection, version, updates)
      this.pushing = false
      // Regardless of whether the push failed or new updates came in
      // while it was running, try again if there's updates remaining
      if (sendableUpdates(this.view.state).length)
        setTimeout(() => this.push(), 100)
    }

    async pull() {
      while (!this.done) {
        let version = getSyncedVersion(this.view.state)
        let updates = await pullUpdates(connection, version)
        this.view.dispatch(receiveUpdates(this.view.state, updates))
      }
    }

    destroy() { 
      console.log('this was called');
      this.done = true
     }
  })
  return [collab({startVersion}), plugin]
}

async function createPeer(parent, connection) {
  let {version, doc} = await getDocument()
  let state = EditorState.create({
    doc,
    extensions: [basicSetup, peerExtension(version, connection)]
  })
  return new EditorView({state, parent})
}

const CodeMirrorEditor = ({socket, value, onChange }) => {
  const editorRef = useRef();
  const [editorView, setEditorView] = useState();
  
  useEffect(() => {
    if (editorView) {
      return;
    }
    
    const updateListener = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        onChange && onChange(update.state.doc.toString());
      }
    });

    // await getDocument(connection)
    // const editorState = EditorState.create({
    //   doc: value,
    //   extensions: [
    //     basicSetup,
    //     oneDark,
    //     javascript(),
    //     updateListener
    //   ],
    // });
    
    

    //const view = new EditorView({ state: editorState, parent: editorRef.current });
    const view = createPeer(editorRef.current, socket);
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