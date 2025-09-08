import * as React from 'react';
import handleInput from '../utils/handleInput';


class Menu extends React.Component {

  constructor() {
    super();

    this.state = {
      selectedList: 'users'
    }


    this.subMenus = [{
      name: 'Users',
      icon: 'group',
      action: () => this.setState({ selectedList: 'users' })
    }, {
      name: 'Settings',
      icon: 'settings',
      action: () => this.setState({ selectedList: 'settings' })
    }, {
      name: 'Shop',
      icon: 'shopping_cart',
      action: () => this.setState({ selectedList: 'shop' })
    }]

  }

  render() {
    const selectedMenu = this.subMenus.find(a => a.name.toLowerCase() === this.state.selectedList);

    return (
      <div className='menuPane' style={{
        background: this.props.themeColor
      }}>
        
        <ul className='quickNav'>

          {
            this.subMenus.map(a => {
              return <li className='navBtn' key={a.name}>
                <span className="material-symbols-outlined" onClick={a.action}>{a.icon}</span>
              </li>
            })
          }

        </ul>

        <div className='menuContent'>
          <div className='menuHeader'>
            <h4> {selectedMenu?.name}</h4>
            {/* <div className='quickNav'>
              <span className="material-symbols-outlined" onClick={() => this.setState({ selectedList: 'shop' })}>shopping_cart</span>
              <span className={`material-symbols-outlined`} onClick={() => this.setState({ selectedList: 'users' })}>group</span>
              <span className="material-symbols-outlined" onClick={() => this.setState({ selectedList: 'settings' })}>keyboard_arrow_down</span>
            </div> */}

          </div>

          {
            this.state.selectedList === 'users' ? 
              <UserList 
                socket={this.props.socket}
                userlist={this.props.userlist} 
              /> : 
              this.state.selectedList === 'settings' ?
                <Settings 
                  toggles={this.props.toggles} 
                  toggleStateChange={this.props.toggleStateChange}
                /> : <Shop
                  hats={this.props.hats}
                />
          }
        </div>

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

              <div className='userLiAFK'>{a.afk} </div>

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

    this.state={
      shopItems: [{
      id: 1,
      name: 'Pick a hat',
      description: ':)',
      price: 100
    }, {
      id: 2,
      name: 'Filter a word',
      description: 'uwu',
      price: 200
      }],
      selectedCat: 'nav'
    }

    this.storeCats = [{
      name: 'Hats',
      description: 'you wear it on your head',
      icon: 'checkroom'
    }, {
      name: 'Filters',
      description: 'One word becomes another',
      icon: 'find_replace'
    }, {
      name: 'MWs',
      description: 'mods text in variety of ways',
      icon: 'wand_stars'
    }]

    // const formatHat = props.hats.map(a=> {
    //   return {
    //     id: a.hatName,
    //     name: a.hatName,
    //     description: a.description,
    //     price: a.price,
    //     image: a.hat
    //   }
    // })

   // this.shopItems = this.shopItems.concat(formatHat);

  }

  componentDidMount() {
    fetch('/getShopItems')
      .then(res => res.json())
      .then(data => {
        console.log(data);

        const formatHat = data.map(a=> {
          return {
            id: a.name +a.id,
            name: a.name,
            image: a.asset,
            price: 100
          }
        });

        this.setState({
          shopItems: this.state.shopItems.concat(formatHat)
        });

      });
  }

  setShopCat(cat) {
    console.log(cat, this.state.selectedCat);
    this.setState({ selectedCat: cat == this.state.selectedCat ? 'nav' : cat });
  }

  render () {

    const selectedCatData = this.storeCats.find(a => a.name.toLowerCase() === this.state.selectedCat);

    return (
      <div className='shopContainer'>

        {
         
          <div className='shopNav'>
            {
              this.storeCats.filter(b=>this.state.selectedCat === 'nav' || b.name.toLowerCase() === this.state.selectedCat).map(a => (
                <div className='shopNavItem' key={a.name} onClick={() => {
                  this.setShopCat(a.name.toLowerCase());
                }}>
                  <span className="material-symbols-outlined">{a.icon}</span>
                  <div>
                    <div>{a.name}</div>
                    <p>{a.description}</p>
                  </div>
                </div>
              ))
            }
          </div>
        }

          {
            this.state.selectedCat == 'hats' ? 
                <div className="hatContainer">
                  {this.props.hats.map(a => (
                    <div key={a.hatName} className="hatItem">
                      <div>
                        <img src={'./images/hats/' + a.hat} alt={a.hatName} style={{width: '50px', height: '50px'}} />
                      </div>
                    </div>
                  ))}
                </div> :
                this.state.selectedCat === 'filters' ? 
              <div>
                <h3>Filters</h3>
              </div> : 
                this.state.selectedCat === 'mws' ?
              <div>
                <h3>MWs</h3>
              </div> : null
          }

          {/* <div className='shopItems'>
            {this.state.shopItems.map(item => (
              <div key={item.id} className='shopItem'>
                {
                  item.image ? <div className='shopItemImage'>
                  <img src={'./images/hats/' + item.image} alt={item.name} />
                </div> : null
                }
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
          </div> */}

 
        
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