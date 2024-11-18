import * as React from 'react';
import handleInput from '../utils/handleInput';


class Menu extends React.Component {

  constructor() {
    super();

    this.state = {}
  }

  render() {
    return (
      <div className='menuPane' style={{
        background: this.props.themeColor
      }}>

        <div className='menuHeader'>
          <h4> {
            this.props.activeList === 'users' ? 'User List' : 'Settings'  
          }</h4>
        </div>

        {
          this.props.activeList === 'users' ? 
            <UserList 
              socket={this.props.socket}
              userlist={this.props.userlist} 
            /> : 
            this.props.activeList === 'settings' ?
              <Settings 
                toggles={this.props.toggles} 
                toggleStateChange={this.props.toggleStateChange}
              /> : null
        }

      </div>
    )

  }

}

class UserList extends React.Component {
  constructor() {
    super();



  }

  getUserActions(name) {

    return [
      {
        name: 'PM',
        callback: () => {}
      },
      {
        name: 'whois',
        callback: () => {
          handleInput.handle('/whois ' + name, this.props.socket);
        }
      },
      {
        name: 'block',
        callback: () => {}
      },
      {
        name: 'MOD',
        callback: () => {}
      }
    ]

  }

  render() {
    return (
      <div className='userLi'>

        {this.props.userlist.map(a => {
          return (
            <div className={'userLiSpan'} key={a.id}>

              <span className='userLiName'>
                {a.nick}
              </span>

              <span className='userLiCurrency'>
                ₵{a.tokens}
              </span>

              <div className='userLiActions'>
                {this.getUserActions(a.nick).map(a => {
                  return (
                    <button 
                      key={a.name} 
                      className='userActionBtn'
                      onClick={a.callback}
                    >
                      {a.name}
                    </button>
                  )
                })}
              </div>

              <div className='userLiAfk'>{a.afk} </div>

            </div>
          )
        })}

      </div>
    )
  }
}

class Settings extends React.Component {

  constructor() {
    super()

  }

  render() {

    console.log(this.props);
    return <div className="settingsContainer">

      {
        Object.entries(this.props.toggles).map(([key,value]) => {
          return (
            <label className='settingsLabel' key={key} onClick={() => {
              this.props.toggleStateChange(key, !value);
            }}>
              {key}
              <button className='stdBtn'>{
                value ? 'On' : 'Off'
              }</button>
            </label>
          )
        })
      }

    </div>
        
  }
}

export class Overlay extends React.Component {
  constructor() {
    super()

  }

  render() {
    console.log(this.props.type)
    return (
      <div className='overlayMask'>

        <h3>{this.props.type}</h3>

      </div>
    )
  }
}

export default Menu;