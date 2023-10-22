import * as React from 'react';


class Menu extends React.Component {

  constructor() {
    super();
  }

  render() {
    return (
      <div className='menuPane'>

        <div className='menuHeader'>
          <h4> User List</h4>
        </div>

        <UserList
          userlist={this.props.userlist}
        />

        {/* <div className='menuActions'>
          <button id='account' className={'menuActionButtons material-symbols-outlined'} onClick={(el) => this.props.toggleOverlay(el.target.id)}>account_circle</button>

          <button id='settings' className={'menuActionButtons material-symbols-outlined'} onClick={(el) => this.props.toggleOverlay(el.target.id)}>settings</button>

          <button id='style' className={'menuActionButtons material-symbols-outlined'} onClick={(el) => this.props.toggleOverlay(el.target.id)}>palette</button>
        </div> */}

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