const express = require('express'),
      app = express(),
      morgan = require('morgan'),
      bodyParser = require('body-parser'),
      uuid = require('uuid');

app.use(morgan('common'));
app.use(bodyParser.json());
app.use(express.static('public'));

let movies = [
  {
    title: 'Fast and Furious 1',
    description: 'A story about a man named Dom, his car and his ability to defy physics with it',
    genre: {
      name: 'Auto-Fantasy',
      description: 'A genre that uses cars that can perform magic'
    } ,
    director: {
      name: 'Car Fan',
      bio: 'A director who loves cars',
    },
  },
  {
    title: 'Fast and Furious 2',
    description: 'A second story about a man named Dom, his car and his ability to defy physics with it',
    genre: {
      name: 'Auto-Fantasy',
      description: 'A genre that uses cars that can perform magic'
    } ,
    director: {
      name: 'Car Fan',
      bio: 'A director who loves cars',
    },
  },
  {
    title: 'Fast and Furious 3',
    description: 'A third story about a man named Dom, his car and his ability to defy physics with it',
    genre: {
      name: 'Auto-Fantasy',
      description: 'A genre that uses cars that can perform magic'
    } ,
    director: {
      name: 'Car Fan',
      bio: 'A director who loves cars',
    },
  },
  {
    title: 'Fast and Furious 4',
    description: 'A fourth story about a man named Dom, his car and his ability to defy physics with it',
    genre: {
      name: 'Auto-Fantasy',
      description: 'A genre that uses cars that can perform magic'
    } ,
    director: {
      name: 'Car Fan',
      bio: 'A director who loves cars',
    },
  },
  {
    title: 'Fast and Furious 5',
    description: 'A fifth story about a man named Dom, his car and his ability to defy physics with it',
    genre: {
      name: 'Auto-Fantasy',
      description: 'A genre that uses cars that can perform magic'
    } ,
    director: {
      name: 'Car Fan',
      bio: 'A director who loves cars',
    },
  },
  {
    title: 'Fast and Furious 6',
    description: 'A sixth story about a man named Dom, his car and his ability to defy physics with it',
    genre: {
      name: 'Auto-Fantasy',
      description: 'A genre that uses cars that can perform magic'
    } ,
    director: {
      name: 'Car Fan',
      bio: 'A director who loves cars',
    },
  },
  {
    title: 'Fast and Furious 7',
    description: 'A seventh story about a man named Dom, his car and his ability to defy physics with it',
    genre: {
      name: 'Auto-Fantasy',
      description: 'A genre that uses cars that can perform magic'
    } ,
    director: {
      name: 'Car Fan',
      bio: 'A director who loves cars',
    },
  },
  {
    title: 'Fast and Furious 8',
    description: 'An eigth story about a man named Dom, his car and his ability to defy physics with it',
    genre: {
      name: 'Auto-Fantasy',
      description: 'A genre that uses cars that can perform magic'
    } ,
    director: {
      name: 'Car Fan',
      bio: 'A director who loves cars',
    },
  },
  {
    title: 'Fast and Furious 9',
    description: 'A ninth story about a man named Dom, his car and his ability to defy physics with it',
    genre: {
      name: 'Auto-Fantasy',
      description: 'A genre that uses cars that can perform magic'
    } ,
    director: {
      name: 'Car Fan',
      bio: 'A director who loves cars',
    },
  },
  {
    title: 'Fast and Furious 10',
    description: 'A tenth story about a man named Dom, his car and his ability to defy physics with it',
    genre: {
      name: 'Auto-Fantasy',
      description: 'A genre that uses cars that can perform magic'
    } ,
    director: {
      name: 'Car Fan',
      bio: 'A director who loves cars',
    },
  }
];

// GET requests
app.get('/', (req, res) => {
    res.send('Welcome to MyFlix!');
  });
  
  app.get('/movies', (req, res) => {
    res.status(200).json(movies);
  });

  app.get('/movies/:title', (req, res) => {
    const { title } = req.params;
    const movie = movies.find(movie => movie.title === title);
   
    if (movie) {
      res.status(200).json(movie);
    } else {
      res.status(400).send('Movie not found');
    }
  });

 
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });
  
  // listen for requests
  app.listen(8080, () => {
    console.log('Your app is listening on port 8080.');
  });

 