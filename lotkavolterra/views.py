import json
from os.path import isfile, join

from flask import render_template, request

from lotkavolterra import app
from lotkavolterra.models import Group, Table, Luncheon, get_random_group
from lotkavolterra.utils import listdir_json


DEFAULT_NUM_GENERATIONS = 20
DEFAULT_POPULATION_SIZE = 1000


# This is relevant for "input-file based simulations" only
INPUT_DIR = 'input'


# These are relevant for "test case simulations" only
DEFAULT_NUM_SEATS = 10
RANDOM = 'random'
ALTERNATING = 'alternating'
HALVES = 'halves'


@app.route("/")
def home():
    """
    Render the homepage, listing available simulations and demos.
    """
    filenames = [f for f in listdir_json(INPUT_DIR)
                 if isfile(join(INPUT_DIR, f))]

    test_simulations = (RANDOM, ALTERNATING, HALVES,)

    context = {
        'input_filenames': filenames,
        'test_simulations': test_simulations,
    }
    return render_template('home.html', **context)


@app.route("/simulation/<input_file>/")
def run_simulation(input_file):
    """
    Run the simulation from an input file.
    """
    # num_seats not used here
    num_generations, population_size, num_seats = _parse_get_params()

    with open(join(INPUT_DIR, input_file), 'r') as f:
        json_data = json.loads(f.read())

    luncheon = Luncheon(json_data['luncheon']['name'])
    current_pk = 0

    # Populate tables from the json input
    for json_table in json_data['luncheon']['tables']:
        table = Table(json_table['name'], x=json_table['x'],
                      y=json_table['y'])

        for index, person in enumerate(json_table['people']):
            try:
                group = Group[person['group']]
            except KeyError:
                group = get_random_group()

            table.insert(current_pk, index, person['name'],
                         group, population_size)
            current_pk += 1

        luncheon.add_table(table)

    # Save initial state
    initial_state = luncheon.export_seat_states()

    # Interact for num_generations
    changes = []
    for generation in range(num_generations):
        luncheon.run_generation()
        changes.append(luncheon.export_seat_sizes())

    context = {
        'simulation_name': luncheon.name,
        'num_generations': num_generations,
        'population_size': population_size,
        'initial_state': initial_state,
        'changes': changes,
        'tables': luncheon.tables,
    }

    return render_template('simulation.html', **context)


@app.route("/test-simulation/<simulation_name>/")
def run_test_simulation(simulation_name):
    """
    Run a test simulation.
    """
    # Uncomment to command line DEBUG logging
    # logging.basicConfig(level=logging.DEBUG)

    num_generations, population_size, num_seats = _parse_get_params()

    # Create and populate Test table
    luncheon = Luncheon('Test')
    table = Table('Test', 0.5, 0.25)
    _populate_test_table(table, simulation_name, num_seats,
                         population_size)
    luncheon.add_table(table)

    # Save initial state
    initial_state = luncheon.export_seat_states()

    # Interact for num_generations
    changes = []
    for generation in range(num_generations):
        luncheon.run_generation()
        changes.append(luncheon.export_seat_sizes())

    context = {
        'simulation_name': simulation_name,
        'num_generations': num_generations,
        'population_size': population_size,
        'num_seats': num_seats,
        'initial_state': initial_state,
        'changes': changes,
        'tables': [table],
    }

    return render_template('simulation.html', **context)


def _populate_test_table(table, simulation, num_seats=DEFAULT_NUM_SEATS,
                         population_size=DEFAULT_POPULATION_SIZE):
    """
    Helper function to populate a test table for a test simulation.

    These test tables are populated from rules, not from a json input file.
    """
    PEOPLE = ('Alice', 'Bob', 'Carol', 'Django', 'Erlich', 'Freddy',
              'Georgia', 'Heidi', 'Indigo', 'Jack',)

    for i in range(num_seats):
        pk = i
        index = i

        try:
            name = PEOPLE[i]
        except IndexError:
            name = 'Person{}'.format(i)

        if simulation == RANDOM:
            table.insert(pk, index, name, get_random_group(),
                         population_size)

        elif simulation == ALTERNATING:
            if i % 2 == 0:
                group = Group.pack
            else:
                group = Group.herd

            table.insert(pk, index, name, group, population_size)

        elif simulation == HALVES:
            if i < (num_seats / 2):
                table.insert(pk, index, name, Group.pack, population_size)
            else:
                table.insert(pk, index, name, Group.herd, population_size)


def _parse_get_params():
    """
    Parse the simulation settings GET parameters.
    """
    try:
        num_generations = int(request.args['num_generations'])
    except Exception:
        num_generations = DEFAULT_NUM_GENERATIONS

    try:
        population_size = int(request.args['population_size'])
    except Exception:
        population_size = DEFAULT_POPULATION_SIZE

    try:
        num_seats = int(request.args['num_seats'])
    except Exception:
        num_seats = DEFAULT_NUM_SEATS

    return (num_generations, population_size, num_seats)


############
# D3 Demos #
############

@app.route("/d3-demo/circles-of-circles/")
def d3_demo_circles_of_circles():
    return render_template('d3_demo_circles_of_circles.html')


@app.route("/d3-demo/random-circles/")
def d3_demo_random_circles():
    return render_template('d3_demo_random_circles.html')
