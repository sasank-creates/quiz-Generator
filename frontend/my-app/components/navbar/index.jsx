import React from 'react';
import styles from './styles.module.css';

const Navbar = () => {
  return (
    <div className={styles.nav}>
      <div className={styles.logo}>
        <h1>Quizzify</h1>
      </div>
      <div className={styles.getStarted}>
            Get Started
      </div>
    </div>
  );
};

export default Navbar;
