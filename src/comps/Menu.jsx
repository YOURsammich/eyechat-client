import * as React from 'react';


class Menu extends React.Component {

  constructor () {
    super();

  }

  render () {

    return <div className='menuContainer'>
      {
        this.props.userlist.map(a=>{
          return <div key={a.id}>{a.nick}</div>
        })
      }
    </div>

  }

}

export default Menu;