const express = require('express'),
      app = express(),
      morgan = require('morgan'),
      uuid = require('uuid'),
      mongoose = require('mongoose'),
      Models = require('./models.js')

const Movies = Models.Movie;
const Users = Models.User;
mongoose.connect('mongodb://localhost:27017/myflixdb', { useNewUrlParser: true, useUnifiedTopology: true });


app.use(morgan('common'));
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));


/* let users = [
  {
    id: 1,
    name: 'John Doe',
    favoriteMovies: ['Fast and Furious 1', 'Fast and Furious 2', 'Fast and Furious 3']
  },
  {
    id: 2,
    name: 'Jane Doe',
    favoriteMovies: ['Fast and Furious 4', 'Fast and Furious 5', 'Fast and Furious 6']
  },
]

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
      birthYear: '1980',
      deathYear: '2023'
    },
    imageURL: 'insert image url here',
    featured: true
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
      birthYear: '1980',
      deathYear: '2023'
    },
    imageURL: 'insert image url here',
    featured: true
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
      birthYear: '1980',
      deathYear: '2023'
    },
    imageURL: 'insert image url here',
    featured: true
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
      birthYear: '1980',
      deathYear: '2023'
    },
    imageURL: 'insert image url here',
    featured: true
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
      birthYear: '1980',
      deathYear: '2023'
    },
    imageURL: 'insert image url here',
    featured: true
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
      birthYear: '1980',
      deathYear: '2023'
    },
    imageURL: 'insert image url here',
    featured: true
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
      birthYear: '1980',
      deathYear: '2023'
    },
    imageURL: 'insert image url here',
    featured: true
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
      birthYear: '1980',
      deathYear: '2023'
    },
    imageURL: 'insert image url here',
    featured: true
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
      birthYear: '1980',
      deathYear: '2023'
    },
    imageURL: 'insert image url here',
    featured: true
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
      birthYear: '1980',
      deathYear: '2023'
    },
    imageURL: 'insert image url here',
    featured: true

  }
]; */

// POST requests

//Add a user
/* We’ll expect JSON in this format
{
  ID: Integer,
  Username: String,
  Password: String,
  Email: String,
  Birthday: Date
}*/

/* app.post('/users', aysnc (req, res) => {
  await Users.findOne({ Username: req.body.Username })
  .then((user) => {
    if (user) {
      return res.status(400).send(req.body.Username + 'already exists');
    } else {
      Users.create({
        Username: req.body.Username,
        Password: req.body.Password,
        Email: req.body.Email,
        Birthday: req.body.Birthday
      }).then((user) => {res.status(201).json(user) })
      .catch((error) => {
        console.error(error);
        res.status(500).send('Error: ' + error);
      })
    }
  })
  .catch((error) => {
    console.error(error);
    res.status(500).send('Error: ' + error);
  })
}); */

// Add a movie to a user's list of favorites
app.post('/users/:Username/movies/:MovieID', async (req, res) => {
  await Users.findOneAndUpdate({ Username: req.params.Username }, {
    $push: { FavoriteMovies: req.params.MovieID }
  },
  { new: true }) // This line makes sure that the updated document is returned
  .then((updatedUser) => {
    res.json(updatedUser);
  })
  .catch((error) => {
    console.error(error);
    res.status(500).send('Error: ' + error);
  });
});


/* app.post('/users/:id/:movieTitle', (req, res) => {
  const { id, movieTitle } = req.params;
  let user = users.find(user => user.id == id);

  if (user) {
    user.favoriteMovies.push(movieTitle);
    res.status(200).send(`${movieTitle} added to favorites`);
  } else {
    res.status(400).send('User not found');
  }
}); */

// DELETE requests

// Delete a user by username
app.delete('/users/:Username', async (req, res) => {
  await Users.findOneAndRemove({ Username: req.params.Username})
  .then((user) => {
    if (!user) {
      res.status(400).send(req.params.Username + ' was not found');
    } else {
      res.status(200).send(req.params.Username + ' was deleted.');
    }
  })
  .catch((error) => {
    console.error(error);
    res.status(500).send('Error: ' + error);
  });
});


/* app.delete('/users/:id/:movieTitle', (req, res) => {
  const { id, movieTitle } = req.params;
  let user = users.find(user => user.id == id);

  if (user) {
    user.favoriteMovies = user.favoriteMovies.filter(title => title !== movieTitle);
    res.status(200).send(`${movieTitle} removed from favorites`);
  } else {
    res.status(400).send('User not found');
  }
}); */

/* app.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  let user = users.find(user => user.id == id);

  if (user) {
    users = users.filter(user => user.id != id);
    res.status(200).send(`User ${id} deleted`);
  } else {
    res.status(400).send('User not found');
  }
}); */




// PUT requests
// Update a user's info, by username
/* We’ll expect JSON in this format
{
  Username: String,
  (required)
  Password: String,
  (required)
  Email: String,
  (required)
  Birthday: Date
}*/

app.put('/users/:Username', async (req, res) => {
  await Users.findOneAndUpdate({ Username: req.params.Username }, { $set:
    {
      Username: req.body.Username,
      Password: req.body.Password,
      Email: req.body.Email,
      Birthday: req.body.Birthday
    }
  },
  { new: true }) // This line makes sure that the updated document is returned  
  .then((updatedUser) => { 
    res.status(201).json(updatedUser);
  })
  .catch((error) => {
    console.error(error);
    res.status(500).send('Error: ' + error);
  });
});


/* app.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const updatedUser = req.body;
  let user = users.find(user => user.id == id);

  if (user) {
    user.name = updatedUser.name;
    res.status(200).json(user);
  } else {
    res.status(400).send('User not found');
  }
}); */

// GET requests

app.get('/users', async (req, res) => {
  await Users.find()
  .then((users) => {
    res.status(201).json(users);
  })
  .catch((error) => { 
    console.error(error);
    res.status(500).send('Error: ' + error);
  });
});

app.get('/users/:Username', async (req, res) => {
  await Users.findOne({ Username: req.params.Username })
  .then((user) => {
    res.json(user);
  })
  .catch((error) => {
    console.error(error);
    res.status(500).send('Error: ' + error);
  });
});

app.get('/', (req, res) => {
    res.send('Welcome to MyFlix!');
  });
  
/*   app.get('/movies', (req, res) => {
    res.status(200).json(movies);
  }); */

  /* app.get('/movies/:title', (req, res) => {
    const { title } = req.params;
    const movie = movies.find(movie => movie.title === title);
   
    if (movie) {
      res.status(200).json(movie);
    } else {
      res.status(400).send('Movie not found');
    }
  }); */

  /* app.get('/movies/genre/:genName', (req, res) => {
    const { genName } = req.params;
    const genre = movies.find(movie => movie.genre.name === genName);

    if (genre) {
      res.status(200).json(genre.genre);
    } else {
      res.status(400).send('Genre not found');
    }
  }); */

 /*  app.get('/movies/director/:dirName', (req, res) => {
    const { dirName } = req.params;
    const director = movies.find(movie => movie.director.name === dirName);

    if (director) {
      res.status(200).json(director.director);
    } else {
      res.status(400).send('Director not found');
    }
  }); */

 
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });
  
  // listen for requests
  app.listen(8080, () => {
    console.log('Your app is listening on port 8080.');
  });

 