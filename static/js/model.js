var utils = require("./utils.js");
var constants = require("./constants.js");
var interactions = require("./interactions.js");


/**
 * A luncheon, made up of Tables, to take part in the simulation.
 */
function Luncheon(params) {
  this.name = params.name;
  this.numTablesX = params.numTablesX;
  this.numTablesY = params.numTablesY;
  this.tables = [];

  // Current trial and generation
  this.trial = 0;
  this.generation = 0;

  /**
   * Add a table to this luncheon.
   */
  this.addTable = function(table) {
    this.tables.push(table);
  };

  /**
   * Run a generation of the simulation.
   *
   * Optionally pass in the number of generations that it should run;
   * defaults to 1.
   */
  this.allSeatsInteract = function(numGenerations) {
    if (numGenerations === undefined) {
      numGenerations = 1;
    }

    var i, j;
    for (i = 0; i < numGenerations; i++) {
      for (j = 0; j < this.tables.length; j++) {
        this.tables[j].allSeatsInteract();
      }
      this.generation += 1;
    }
  };

  /** Set all seats at this luncheon to initial population size. */
  this.reset = function() {
    for (var i = 0; i < this.tables.length; i++) {
      this.tables[i].reset();
    }

    this.generation = 0;
    this.trial += 1;
  };

  /** Get all seats at this luncheon. */
  this.getAllSeats = function() {
    var seats = [];
    for (var i = 0; i < this.tables.length; i++) {
      seats = seats.concat(this.tables[i].getAllSeats());
    }
    return seats;
  }
}


/**
 * A table to take part in the simulation.
 *
 * A table is a circlular doubly linked list of Seats.
 */
function Table(params) {
  this.number = params.number || 0;
  this.name = params.name || "Test";

  // Relative position in space
  this.x = params.x;
  this.y = params.y;

  if (this.x === undefined) {
    this.x = 0.5;
  }

  if (this.y === undefined) {
    this.y = 0.5;
  }

  // Table is initially empty
  this.head = null;
  this.seatCount = 0;

  /**
   * Insert a new seat at the head of this table.
   */
  this.insert = function(params) {
    params.table = this;
    newSeat = new Seat(params);

    if (!this.head) {
      newSeat.setNext(newSeat);
      newSeat.setPrevious(newSeat);
    } else {
      // Create new pointers
      newSeat.setPrevious(this.head);
      newSeat.setNext(this.head.getNext());

      // Update old pointers
      newSeat.getNext().setPrevious(newSeat);
      newSeat.getPrevious().setNext(newSeat);
    }

    this.head = newSeat;
    this.seatCount += 1;
  };

  /**
   * Get all seats at this table.
   */
  this.getAllSeats = function() {
    var seats = [];

    if (!this.head) {
      return seats;
    }

    seats.push(this.head);

    var current = this.head.getNext()
    while (current != this.head) {
      seats.push(current);
      current = current.getNext();
    }

    return seats;
  };

  // TODO: consider having the three functions below not call getAllSeats()

  /**
   * Have all seats at this table interact for numGenerations.
   */
  this.allSeatsInteract = function(numGenerations) {
    if (numGenerations === undefined) {
      numGenerations = 1;
    }

    var seats = this.getAllSeats();

    var i, j;
    for (i = 0; i < numGenerations; i++) {
      for (j = 0; j < seats.length; j++) {
        seats[j].interactWithNextInteractor();
      }
    }
  };

  /** Set all seats at this table to initial population size. */
  this.reset = function() {
    var seats = this.getAllSeats();

    for (var i = 0; i < seats.length; i++) {
      seats[i].reset();
    }
  };
}


/**
 * A Seat at a Table.
 *
 * Each seat can be assigned a group (Pack, Herd, Colony) and a
 * population size.
 *
 * A seat is connected to both adjacent seats, in circular doubly-linked
 * list fashion.
 */
function Seat(params) {
  // TODO: firstName and shortSpecies maybe can use "this"
  this.pk = params.pk;  // Unique identifier across tables
  this.index = params.index;  // Position within the table
  this.name = params.name;
  this.firstName = params.name ? params.name.split(/\s+/)[0] : "";
  this.group = params.group;
  this.species = constants.Species[params.group];
  this.shortSpecies = constants.Species[params.group].split(/\s+/)[1];
  this.populationSize = constants.INITIAL_POPULATION_SIZE;
  this.table = params.table;
  this.nextSeat = params.nextSeat;
  this.previousSeat = params.previousSeat;

  /** Get the next adjacent seat. */
  this.getNext = function() {
    return this.nextSeat;
  };

  /** Get the previous adjacent seat. */
  this.getPrevious = function() {
    return this.previousSeat;
  };

  /** Set the next adjacent seat. */
  this.setNext = function(other) {
    this.nextSeat = other;
  };

  /** Set the previous adjacent seat. */
  this.setPrevious = function(other) {
    this.previousSeat = other;
  };

  /** Determine if this seat is a herd. */
  this.isHerd = function() {
    return this.group === constants.Group.HERD;
  };

  /** Determine if this seat is a pack. */
  this.isPack = function() {
    return this.group === constants.Group.PACK;
  };

  /** Determine if this seat is a colony. */
  this.isColony = function() {
    return this.group === constants.Group.COLONY;
  };

  /**
   * If this seat is a colony, change it randomly to a pack or herd.
   *
   * Returns true if this seat was initially a colony (now changed to
   * pack or herd).
   *
   * Returns false if this seat was not initally a colony (unchanged).
   */
  this.changeGroupIfColony = function() {
    if (!this.isColony()) {
      return false;
    }

    this.group = utils.getRandomChoice([
      constants.Group.PACK,
      constants.Group.HERD
    ]);

    return true;
  };

  /**
   * Set this seat's group to colony.
   *
   * Use this to restore a seat after calling changeGroupIfColony().
   */
  this.setToColony = function() {
    this.group = constants.Group.COLONY;
  };

  /** Increase this seat's population size by growthRate. */
  this.increasePopulation = function(growthRate) {
    change = Math.round(this.populationSize * growthRate);
    this.populationSize += change;

    // Extinction from overpopulation
    if (this.populationSize >= constants.OVERPOPULATION_SIZE) {
      this.populationSize = 0;
    }
  };

  /** Decrease this seat's population size by growthRate. */
  this.decreasePopulation = function(growthRate) {
    change = Math.round(this.populationSize * growthRate);
    this.populationSize -= change;

    // Extinction if no further decline is not possible
    if (Math.round(this.populationSize * growthRate) === 0) {
      this.populationSize = 0;
    }
  };

  /** Determine if this seat has become extinct. */
  this.isExtinct = function() {
    return this.populationSize === 0;
  };

  /**
   * Get the next interactor for this seat.
   *
   * Returns null if this seat is extinct, or if this seat is the only
   * node left.
   */
  this.getNextInteractor = function() {
    if (this.isExtinct()) {
      return null;
    }

    interactor = this.getNext();
    while (interactor.isExtinct()) {
      interactor = interactor.getNext();
    }

    /*
    // Enable this to freeze "last man standing"
    if (this === interactor) {
      return null;
    }
    */

    return interactor;
  };

  /** Interact with the next defined interactor. */
  this.interactWithNextInteractor = function() {
    interactor = this.getNextInteractor();
    if (interactor) {
      interactions.interact(this, interactor);
    }
  };

  /** Reset this seat to its initial population size. */
  this.reset = function() {
    this.populationSize = constants.INITIAL_POPULATION_SIZE;
  };
}


module.exports = {
  Luncheon: Luncheon,
  Table: Table
};
