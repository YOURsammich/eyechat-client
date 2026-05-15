import { useState, useRef, useEffect } from 'react';

function parseTimeString(timeString) {
  const date = new Date(timeString);
  return {
    date: date.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' }),
    time: date.toLocaleDateString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
  };
}

function PM_Input({ socket, convoWith }) {
  function submitValue(event) {
    if (event.code === 'Enter') {
      socket.emit('pmSend', { to: convoWith, message: event.target.value });
      event.target.value = null;
    }
  }
  return (
    <div className='pmInputBanner'>
      <input type='text' className='pmInputBar' onKeyDown={submitValue} placeholder='Enter message here...' />
    </div>
  );
}

function PM_List({ conversationList, selectConvo }) {
  return (
    <div className='convoContainer'>
      {conversationList.map((convo) => (
        <div key={convo.convoid} className='convoBanner'>
          <div className='hoverMask convoBanner' onClick={() => selectConvo(convo)}>
            <span>{convo.with}</span>
            <span className='messagePreview'> {convo.last_message} </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PM_Convo({ getConvoProp, getMessages, socket }) {
  const convoRef = useRef(null);

  useEffect(() => {
    const current = convoRef.current;
    if (current) {
      current.scrollTop = current.scrollHeight;
    }
  }, []);

  function handleScroll() {
    const current = convoRef.current;
    if (current.scrollTop === 0) {
      const convo = getConvoProp('all');
      const offset = convo?.messages?.length ?? 0;
      getMessages(convo.convoid, offset);
      current.scrollTop += 1;
    }
  }

  return (
    <div className='pmBody'>
      <div className='convoDetails' ref={convoRef} onScroll={handleScroll}>
        {getConvoProp('messages')?.map((message) => (
          <div key={message.messageid}
            className={`convoMessage ${message.sender === getConvoProp('with') ? 'sender' : 'receiever'}`}
          >
            {message.time_sent.time} / {message.receiver}: {message.msg}
          </div>
        ))}
      </div>
      <PM_Input socket={socket} convoWith={getConvoProp('with')} />
    </div>
  );
}

function PM_Window({ socket, user }) {
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [conversationList, setConversationList] = useState([]);

  useEffect(() => {
    socket.emit('pmRequest', { initialize: true });

    const offConvos = socket.on('pmConvos', (convos) => {
      const newConvos = convos.map(convo => ({
        ...convo,
        with: convo.participant1 === user.nick ? convo.participant2 : convo.participant1
      }));
      setConversationList(prev => [...prev, ...newConvos]);
    });

    const offMessages = socket.on('pmMessage', (messages) => {
      if (!messages) return;
      const newMessages = messages.map(message => ({
        ...message,
        time_sent: parseTimeString(message.time_sent)
      }));
      updateConvo(newMessages);
    });

    return () => { offConvos(); offMessages(); };
  }, []);

  function updateConvo(messages) {
    const idToUpdate = messages[0].convoid;
    setConversationList(prev => prev.map(convo => {
      if (convo.convoid !== idToUpdate) return convo;
      const updated = convo.messages ? [...convo.messages, ...messages] : messages;
      updated.sort((a, b) => a.messageid - b.messageid);
      return { ...convo, messages: updated };
    }));
  }

  function selectConvo(convo) {
    if (!convo.messages?.length) getMessages(convo.convoid, 0);
    setSelectedConvo(convo.convoid);
  }

  function getMessages(convoid, offset) {
    socket.emit('pmRequest', { convoid, offset, initialize: false });
  }

  function getConvoProp(prop) {
    const convo = conversationList.find(c => c.convoid === selectedConvo);
    if (prop === 'all') return convo ?? null;
    return convo?.[prop] ?? null;
  }

  return (
    <div className='convosContainer'>
      <div className='convoHeader'>
        {selectedConvo ? (
          <>
            <button className='hoverMask convoHeaderButtons material-symbols-outlined' style={{ left: '5px' }} onClick={() => setSelectedConvo(null)}>chevron_left</button>
            <h3>{`Convo with ${getConvoProp('with')}`}</h3>
          </>
        ) : (
          <>
            <h3>Your Conversations</h3>
            <button style={{ right: '5px' }} className='convoHeaderButtons hoverMask material-symbols-outlined' onClick={() => console.log('/pm user message for now')}>chat_add_on</button>
          </>
        )}
      </div>
      {!selectedConvo
        ? <PM_List conversationList={conversationList} selectConvo={selectConvo} />
        : <PM_Convo getConvoProp={getConvoProp} getMessages={getMessages} socket={socket} />
      }
    </div>
  );
}

export { PM_Window as PM };
