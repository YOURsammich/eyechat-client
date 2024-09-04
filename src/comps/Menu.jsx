import * as React from 'react';


class Menu extends React.Component {

  constructor() {
    super();

    this.state = {}
  }

  render() {
    return (
      <div className='menuPane'>

        <div className='menuHeader'>
          <h4> {
            this.props.activeList === 'users' ? 'User List' : 'Settings'  
          }</h4>
        </div>

        {
          this.props.activeList === 'users' ? 
            <UserList userlist={this.props.userlist} /> : 
            this.props.activeList === 'settings' ?
              <Settings /> : null
        }

      </div>
    )

  }

}

class UserList extends React.Component {
  constructor() {
    super();

  }

  handleUserAction(id) {
    console.log(id)
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
                <a id='Function1' onClick={(el) => this.handleUserAction(el.target.id)}>Func1</a>

                <a id='Function2' onClick={(el) => this.handleUserAction(el.target.id)}>Func2</a>

                <a id='Function3' onClick={(el) => this.handleUserAction(el.target.id)}>Func3</a>
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

    this.state = {
      settings: {
        theme: 'light',
        notifications: 'on',
        sound: 'on',
      }
    }
  }

  render() {
    return <div className="settingsContainer">

      <label className='settingsLabel'>
        Background
        <button className='stdBtn'>Enable</button>
      </label>

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