class Store {
  constructor() {
    //states to be saved locally
    this.saveAttrs = ['color', 'bgcolor', 'glow', 'nick', 'token', 
      'currentProfile', 'cursor', 'flair', 'font',
      'lock', 'menu-order', 'proxy', 'style', 'part', 'hotlink',
      'bubble', 'block'];

    this.stateStruct = {
      poll_votes: {
        keys: ['poll_Id', 'answer'],
        value: 'nick',
        array: true
      },
      joinnick: {
        keys: ['type'],
        value: 'name',
        array: true,
        dubs: true
      },
      roles: {
        keys: ['role'],
        value: 'nick',
        array: true
      },
      filteredWords: {
        keys: ['replace'],
        value: 'withThis'
      },
      emojis: {
        keys: ['id'],
        value: ['imageName', 'nick', 'category']
      },
      themecolors: {
        keys: ['themeKey'],
        value: 'themeValue'
      },
      polls: {
        keys: ['poll_Id'],
        value: ['category', 'nick', 'pollQuestion', 'answers', 'closed', 'writeins', 'serious']
      },
      pms: {
        keys: ['pmID'],
        value: ['messageTo', 'num', 'unread', 'messageData'],
        array: true
      },
      plugins: {
        keys: ['name'],
        value: ['madeBy', 'description', 'approved', 'category', 'force']
      },
      plugin_opt: {
        keys: ['pluginName'],
        value: 'nick',
        array: true,
        dubs: true
      },
      styleProfiles: {
        keys: ['id'],
        value: ['flair']
      },
      keyframes: {
        keys: ['id'],
        value: 'css'
      },
      pinned: {
        keys: ['channelName'],
        value: 'nick',
        array: true
      },
      user_inventory: {
        keys: ['item'],
        value: 'count'
      }
    };

    // save chat atr to this.storedAttributes
    this.storedAttributes = {};
    const allKeys = Object.keys(localStorage);
    for (let key of allKeys) {
      if (key !== '__proto__' && key.startsWith('chat') && (this.saveAttrs.indexOf(key.slice(5)) !== -1) || 
                key.slice(5, 11) === 'toggle') {
        const keyName = key.substring(5);
        try {
          this.setState(keyName, JSON.parse(localStorage[key]));
        } catch (err) {
          this.setState(keyName, localStorage[key]);
        }
      }
    }

  }

  _set (attribute, value, noSave) {
    this.storedAttributes[attribute] = value;

    // save to localStorage
    if (!noSave) {
      if (typeof value === 'object') value = JSON.stringify(value);
      localStorage.setItem('chat-' + attribute, value);
    }
  }

  setState (attribute, newValue, noSave) {
    const stateInstructions = this.stateStruct[attribute];

    if (attribute == 'nick' && typeof newValue != 'string') {
      newValue = newValue.toString();
    }

    if (stateInstructions) {
      this._set(attribute, '');
      this.assignState(attribute, newValue);
    } else {
      this._set(attribute, newValue, noSave);
    }
  }

  assignState (stateName, setData) {
    //if (!this.storedAttributes[stateName]) this.storedAttributes[stateName] = {};
    
    const state = {};
    const stateInstructions = this.stateStruct[stateName];
    
    if (!stateInstructions) return;
    
    for (let newState of setData) {
      let ref = state;
    
      //create value
      let stateValue;
      if (Array.isArray(stateInstructions.value)) {
        stateValue = {};
    
        for (let key of stateInstructions.value) {
          stateValue[key] = newState[key];
        }
      } else {
        stateValue = newState[stateInstructions.value];
      }
    
      //create data struct
      const structKeys = stateInstructions.keys;
      for (let i = 0; i < structKeys.length - 1; i++) {
        //the stateInstructions tells us the next key to be made
        const key = structKeys[i];
        //the setData tells us that keys name
        const keyName = newState[key];
                
        //we're done making the data structure
        if (!ref[keyName]) ref[keyName] = {};

        ref = ref[keyName];
      }

      //time to assign value
      const key = structKeys[structKeys.length - 1];
      const primeKeyName = newState[key];

      if (stateInstructions.array) {
        if (!ref[primeKeyName]) ref[primeKeyName] = [];

        //remove old value
        // if (!stateInstructions.dubs) {
        //   this.searchRemove(ref, primeKeyName, stateValue);
        // }

        ref[primeKeyName].push(stateValue);
      } else {
        ref[primeKeyName] = stateValue;
      }
    }

    return state;
  }

  get (attribute) {
    // short cuts
    if (this.altAtt[attribute]) attribute = this.altAtt[attribute];

    const storedValue = this.storedAttributes[attribute] !== undefined ? this.storedAttributes[attribute] : this.defaultStateValues[attribute];
        
    const isAnArray = Array.isArray(storedValue);

    return (typeof storedValue === 'object') ? (isAnArray ? [...storedValue] : {...storedValue}) : storedValue;
  }

  remove (attribute) {
    delete this.storedAttributes[attribute];
    localStorage.removeItem('chat-' + attribute);
  }

  removeKey (attribute, data) {
    const state = this.storedAttributes[attribute];
    const stateStruct = this.stateStruct[attribute];
    const keys = stateStruct.keys;
    const value = stateStruct.value;
    
    let ref = state;
    let primeKey = keys[0];
    
    //key nav
    for (let i = 1; i < keys.length; i++) {
      const key = keys[i];
      const keyFromData = data[key];
    
      if (keyFromData) {
        primeKey = key;
        ref = state[keyFromData];
      }
    }
    
    //get value
    const valueKey = data[value];
    
    if (valueKey) {
      ref = ref[data[primeKey]];
    
      const index = ref.indexOf(valueKey);
      if (index !== -1) {
        ref.splice(index, 1);
      }
    } else if (ref[data[primeKey]]) {
      delete ref[data[primeKey]];
    }
    
    //if (typeof state === 'object') state = JSON.stringify(state);
    //localStorage.setItem('chat-' + attribute, state);
  }

  searchRemove (state, key, value) {
    //if (key) state = state[key];
    
    const entires = Object.entries(state);
    entires.map((curr) => {
      const [key, ary] = curr;
      const index = ary.indexOf(value);
      if (index !== -1) {
        ary.splice(index, 1);
      }
    
    });
  }

  handleStates (states) {
    const toggles = ['channelTgl-filteredWords', 'channeltglcentermsg', 'channelTgl-logMessages'];
    const assignToState = ['themecolors', 'filteredWords', 'emojiss', 'polls', 'poll_votes', 'joinnick', 'roles', 'pms', 'plugins', 'plugin_opt', 'messages', 'keyframes', 'pinned', 'block', 'user_inventory'];
    
    const formattedStates = {};

    const stateKeys = Object.keys(states);
    for (let state of stateKeys) {
      try {
        states[state] = JSON.parse(states[state]);
      } catch (err) {
        //
      }

      const value = states[state];

      if (toggles.indexOf(state) !== -1) {
        //this.setToggle(state, value);
      } else if (assignToState.indexOf(state) !== -1) {
        formattedStates[state] = this.assignState(state, value);
      } else {
        formattedStates[state] = value;
      }
    }

    return formattedStates;
  }

}

export default Store;