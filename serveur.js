var express = require('express');
var app = express();
var server = require('http').Server(app);
var io  =  require ( 'socket.io' ) . listen ( server ) ;  
var log4js = require('log4js');
const fs = require('fs');
const api = require('http');
const querystring = require('querystring');

log4js.configure({
  appenders: {
    everything: { type: 'file', filename: 'logs/all-the-logs.log' },
    emergencies: { type: 'file', filename: 'logs/error.log' },
     console : {    type: "console" ,layout: {
        type: 'pattern',
        pattern: '%[[%d{dd-MM-yyyy hh:mm:ss.SSS}] [%p] %c -%] %m',
    }},
    'just-errors': { type: 'logLevelFilter', appender: 'emergencies', level: 'error' }
  },
  categories: {
    default: { appenders: ['just-errors', 'everything','console' ], level: 'trace' }
  }
});
var log = log4js.getLogger('SERVER');

// On charge le fichier de config
let rawdata = fs.readFileSync('config.json');
let configJSON = JSON.parse(rawdata);

const optionsPingAPI = {
  hostname: configJSON.api.address,
  port: configJSON.api.port,
  path: '/',
  method: 'GET'
} 

server.listen(configJSON.port,configJSON.address, function () {
  log.info(`Listening ${server.address().address} on ${server.address().port}`);

  // Call de l'api : Si il n'est pas présent, le serveur se ferme (vu que on peut rien faire sans)
  const req = api.request(optionsPingAPI, res => {
      log.info('API présente');
  });
  
  req.on('error', error => {
      log.error(error)
      server.close(() => {
        log.error('API non présente, arrêt du serveur');
      })
  });

  req.end();

	
io.on('connection', function (socket) {
  log.info('A user connected ');
  
  socket.emit('authentification', {  });

  socket.on('Ping', function () {
    log.info('Ping');
     
    // ** Test de réponse ** //
    
    socket.emit('Pong');
  });
  
  socket.on('authentification', function (receiveData) {
    log.info(receiveData);

    //Parse des donnés reçus
    var AuthData = querystring.stringify({
      'username' : receiveData.username,
      'mdp'  : receiveData.password
    });

    var optionsAuthAccount = {
      host: configJSON.api.address,
      port: configJSON.api.port,
      path: '/signin',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': AuthData.length
      }
    };

    var etat; 
    var data;
    var msg_error;
    var statusCode ;

    // ** Traitement pour l'authentification d'un utilisateur ** //

    if (receiveData.username === '')
      {
        etat = "error";
        socket.emit('authentification_Data',etat,data);
        socket.disconnect();
        log.error("Echec d'authentification d'utilisateur' : Champs manquant ");
      }
    else
      {
        // function returns a Promise
            function getPromise() {
              return new Promise((resolve, reject) => {
                var req = api.request(optionsAuthAccount, (res) => {
                  log.debug('statusCode :', res.statusCode);
                  statusCode = res.statusCode;
                  log.debug('headers : ', res.headers);
                  
                  res.on('data', (d) => {
                    ///process.stdout.write(d);
                    resolve(JSON.parse(d));
                  });
                });
                
                req.on('error', (e) => {
                  log.error(e);
                  reject(e);
                });
                
                req.write(AuthData);
                req.end();

              });
            }

        // On met la promessse dans une fonction async
            async function makeSynchronousRequest(request) {
              try {
                let http_promise = getPromise();
                data = await http_promise;

                // holds response from server that is passed when Promise is resolved
            
              }
              catch(error) {
                log.error(error);
              }
            }
            // anonymous async function
      (async function () {
        // Attend la fin de la requet http
        await makeSynchronousRequest(); 
        // Aprés la fin de la requet http
          if ( statusCode == 200 )
            {
              log.trace('etat '+etat);
              log.trace(data);
              socket.emit('authentification_Data',etat,data);
              log.info("Authentification d'utilisateur réussi !");
            }
          else   
            {
              etat = "error";
              msg_error = JSON.parse(JSON.stringify(data))
              log.trace('etat '+etat);
              log.trace(data);
              socket.emit('authentification_Data',etat,data);
              socket.disconnect();
              log.info(msg_error);
              log.error("Echec d'authentification d'utilisateur' : "+msg_error.error);
            }
            
        })();

      }
    
  });

  socket.on('disconnect', function () {
    log.info('user disconnected');

  });
});


});

