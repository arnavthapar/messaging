const mysql = require('mysql2/promise');

/*const pool = mysql.createPool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_CODE,
    database: process.env.DATABASE_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});*/
/*console.log('DB Config:', {
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    port: process.env.MYSQLPORT,
    database: process.env.MYSQLDATABASE,
    hasPassword: !!process.env.MYSQLPASSWORD
});*/
const pool = mysql.createPool({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    port: parseInt(process.env.MYSQLPORT),
    database: process.env.MYSQLDATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    family: 4
});

//const pool = mysql.createPool(process.env.DATABASE_URL);


module.exports = pool;