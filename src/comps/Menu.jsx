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
          <h4> {this.props.activeList}</h4>
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
              /> : <Shop
                hats={this.props.hats}
              />
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

class Shop extends React.Component {
  constructor(props) {
    super();

    this.shopItems = [{
      id: 1,
      name: 'Pick a hat',
      description: ':)',
      price: 100
    }, {
      id: 2,
      name: 'Filter a word',
      description: 'uwu',
      price: 200
    }];

    const formatHat = props.hats.map(a=> {
      return {
        id: a.hatName,
        name: a.hatName,
        description: a.description,
        price: a.price,
        image: a.hat
      }
    })

    this.shopItems = this.shopItems.concat(formatHat);

  }

  render () {

    return (
      <div className='shopContainer' style={{width: '300px'}}>

        <div className='shopNav'>
          <span className='shopNavItem'>All</span>
          <span className='shopNavItem'>Hats</span>
          <span className='shopNavItem'>Filters</span>
        </div>

        <div className='shopItems'>
          {this.shopItems.map(item => (
            <div key={item.id} className='shopItem'>
              <div className='shopItemImage'>
                <img src={'./images/hats/' + item.image} alt={item.name} />
              </div>
              <div className='shopItemDescription'>                
                <span className='shopItemName'>{item.name}</span>
                <span className='shopItemDesc'>{item.description}</span>
                <div className='shopBuy'>
                  <span className='shopItemPrice'>₵{item.price}</span>
                  <button className='stdBtn'>Buy</button>
                </div>
              </div>
            </div>
          ))}
        </div>
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