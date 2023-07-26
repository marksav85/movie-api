const express = require('express'),
      app = express(),
      morgan = require('morgan'),
      bodyParser = require('body-parser'),
      uuid = require('uuid');

app.use(morgan('common'));

app.use(express.static('public'));

let movies = [
  {
    title: 'Fast and Furious 1', 
  },
  {
    title: 'Fast and Furious 2',
  },
  {
    title: 'Fast and Furious 3',
  },
  {
    title: 'Fast and Furious 4',
  },
  {
    title: 'Fast and Furious 5',
  },
  {
    title: 'Fast and Furious 6',
  },
  {
    title: 'Fast and Furious 7',
  },
  {
    title: 'Fast and Furious 8',
  },
  {
    title: 'Fast and Furious 9',
  },
  {
    title: 'Fast and Furious 10',
  }
];

// GET requests
app.get('/', (req, res) => {
    res.send('Welcome to MyFlix!');
  });
  
  app.get('/movies', (req, res) => {
    res.json(movies);

  });
 
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });
  
  // listen for requests
  app.listen(8080, () => {
    console.log('Your app is listening on port 8080.');
  });

 