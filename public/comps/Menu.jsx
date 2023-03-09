import * as React from 'react';


class Menu extends React.Component {

  constructor () {
    super();

    this.state = {
      userlist: []
    }

  }

  componentDidMount () {

    this.props.socket.on('userlist', (userlist) => {
      console.log(userlist);
      this.setState({userlist: userlist})
    });
    this.props.socket.on('userJoin', (user) => {
      console.log(user);

      const userlist = [...this.state.userlist];
      userlist.push(user);

      this.setState({userlist})

    });
    this.props.socket.on('userLeft', (user) => {
      const userlist = [...this.state.userlist];
      const index = userlist.findIndex(a=> a.id == user.id);

      if (index !== -1) { 
        userlist.splice(index, 1);
        this.setState({userlist})
      }
    });

  }

  render () {

    return <div className='menuContainer'>
      {
        this.state.userlist.map(a=>{
          return <div key={a.id}>{a.nick}</div>
        })
      }
    </div>

  }

}

export default Menu;