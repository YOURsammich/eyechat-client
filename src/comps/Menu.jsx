import * as React from 'react';


class Menu extends React.Component {

  constructor() {
    super();

  }

  render() {

    return <div className='menuContainer'>
      {
        this.props.userlist.map(a => {
          return (
            <div key={a.id}>
              <div>
                {a.nick}
                <span style={{
                  position: 'absolute',
                  right: 10,
                  color: 'yellow',
                  fontStyle: 'italic',
                  fontSize: 'smaller'
                }}>
                  ￦&nbsp;&nbsp;{a.tokens}
                </span>
              </div>
              <div className='informer'>{a.afk} </div> 
            </div>
          );
        })
      }
    </div>

  }

}

export default Menu;