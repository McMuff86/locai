import requests
import csv

# Funktion zum Abrufen von Daten von einer URL
def fetch_data(url):
    print(f"Rufe Daten ab von: {url}")
    response = requests.get(url)
    response.raise_for_status()  # Fehler, wenn der Abruf fehlschlägt
    return response.json()

# Funktion zum Parsen der Evolutionskette
def parse_evolution_chain(chain):
    evo_dict = {}

    def recurse_chain(current, previous=None):
        species_name = current["species"]["name"]
        evo_dict[species_name] = {"from": previous, "to": []}
        for evo in current["evolves_to"]:
            evo_name = evo["species"]["name"]
            evo_dict[species_name]["to"].append(evo_name)
            recurse_chain(evo, species_name)

    recurse_chain(chain["chain"])
    return evo_dict

# Cache für Evolutionsketten
evo_cache = {}

# CSV-Datei öffnen und schreiben
with open("pokemon.csv", "w", newline="", encoding="utf-8") as csvfile:
    fieldnames = [
        "id", "pokedex_number", "name", "type_primary", "type_secondary",
        "hp", "attack", "defense", "special_attack", "special_defense", "speed",
        "height", "weight", "description", "evolution_from", "evolution_to", "image_url"
    ]
    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
    writer.writeheader()
    print("CSV-Datei erstellt und Header geschrieben")

    # Schleife durch die ersten 151 Pokémon
    for id in range(1, 152):
        print(f"Verarbeite Pokémon mit ID: {id}")
        
        # Pokémon-Daten abrufen
        pokemon_data = fetch_data(f"https://pokeapi.co/api/v2/pokemon/{id}/")

        # Basisinformationen extrahieren
        pokedex_number = id
        name = pokemon_data["name"]
        print(f"Extrahiere Daten für: {name}")
        types = [t["type"]["name"] for t in pokemon_data["types"]]
        type_primary = types[0]
        type_secondary = types[1] if len(types) > 1 else ""
        stats = {s["stat"]["name"]: s["base_stat"] for s in pokemon_data["stats"]}
        hp = stats["hp"]
        attack = stats["attack"]
        defense = stats["defense"]
        special_attack = stats["special-attack"]
        special_defense = stats["special-defense"]
        speed = stats["speed"]
        height = pokemon_data["height"] / 10  # Dezimeter zu Meter
        weight = pokemon_data["weight"] / 10  # Hektogramm zu Kilogramm
        image_url = pokemon_data["sprites"]["other"]["official-artwork"]["front_default"]

        # Spezies-Daten abrufen
        species_url = pokemon_data["species"]["url"]
        print(f"Rufe Spezies-Daten ab von: {species_url}")
        species_data = fetch_data(species_url)

        # Beschreibung aus Rot/Blau (Englisch) extrahieren
        flavor_text_entries = species_data["flavor_text_entries"]
        description = ""
        for entry in flavor_text_entries:
            if entry["language"]["name"] == "en" and entry["version"]["name"] in ["red", "blue"]:
                description = entry["flavor_text"].replace("\n", " ").replace("\f", "")
                break
        if description:
            print(f"Beschreibung für {name} gefunden: {description}")
        else:
            print(f"Keine Beschreibung für {name} gefunden")

        # Evolutionskette abrufen
        evolution_chain_url = species_data["evolution_chain"]["url"]
        if evolution_chain_url not in evo_cache:
            print(f"Rufe Evolutionskette ab von: {evolution_chain_url}")
            evolution_chain_data = fetch_data(evolution_chain_url)
            evo_dict = parse_evolution_chain(evolution_chain_data)
            evo_cache[evolution_chain_url] = evo_dict
        else:
            evo_dict = evo_cache[evolution_chain_url]
            print(f"Nutze zwischengespeicherte Evolutionskette für {name}")

        # Evolutionsdetails extrahieren
        evo_details = evo_dict.get(name, {"from": None, "to": []})
        evolution_from = evo_details["from"] if evo_details["from"] else ""
        evolution_to = ", ".join(evo_details["to"]) if evo_details["to"] else ""
        print(f"Evolutionsdetails für {name}: Entwickelt sich von {evolution_from}, zu {evolution_to}")

        # Daten in CSV schreiben
        writer.writerow({
            "id": id,
            "pokedex_number": pokedex_number,
            "name": name,
            "type_primary": type_primary,
            "type_secondary": type_secondary,
            "hp": hp,
            "attack": attack,
            "defense": defense,
            "special_attack": special_attack,
            "special_defense": special_defense,
            "speed": speed,
            "height": height,
            "weight": weight,
            "description": description,
            "evolution_from": evolution_from,
            "evolution_to": evolution_to,
            "image_url": image_url
        })
        print(f"Daten für {name} in CSV geschrieben\n")