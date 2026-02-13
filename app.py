from flask import Flask, send_from_directory, jsonify, render_template, request
import json
import os

app = Flask(__name__, static_folder='frontend', static_url_path='')

# Path to the chart data
CHART_PATH = os.path.join('backend', 'json', 'chart.json')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/game')
def game():
    return send_from_directory(app.static_folder, 'game.html')

@app.route('/songs/<path:filename>')
def serve_song(filename):
    return send_from_directory(os.path.join('backend', 'song'), filename)

@app.route('/api/charts')
def get_charts():
    try:
        with open(CHART_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

RANKINGS_PATH = os.path.join('backend', 'json', 'rankings.json')
FAVORITES_PATH = os.path.join('backend', 'json', 'favorites.json')

def ensure_json_exists(path):
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({}, f)

@app.route('/api/rankings', methods=['GET'])
def get_rankings():
    song_name = request.args.get('song')
    ensure_json_exists(RANKINGS_PATH)
    with open(RANKINGS_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data.get(song_name, []) if song_name else data)

@app.route('/api/rankings', methods=['POST'])
def post_ranking():
    entry = request.json # {song: str, name: str, score: int}
    song_name = entry.get('song')
    ensure_json_exists(RANKINGS_PATH)
    with open(RANKINGS_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if song_name not in data:
        data[song_name] = []
    
    data[song_name].append({
        "name": entry.get('name', 'Anonymous'),
        "score": entry.get('score', 0),
        "date": entry.get('date', '')
    })
    
    # Sort and keep top 10
    data[song_name] = sorted(data[song_name], key=lambda x: x['score'], reverse=True)[:10]
    
    with open(RANKINGS_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return jsonify({"success": True, "rankings": data[song_name]})

@app.route('/api/favorites', methods=['GET'])
def get_favorites():
    ensure_json_exists(FAVORITES_PATH)
    with open(FAVORITES_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return jsonify(data)

@app.route('/api/favorites', methods=['POST'])
def post_favorite():
    entry = request.json # {song: str, favorite: bool}
    song_name = entry.get('song')
    ensure_json_exists(FAVORITES_PATH)
    with open(FAVORITES_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if entry.get('favorite'):
        data[song_name] = True
    else:
        if song_name in data:
            del data[song_name]
            
    with open(FAVORITES_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
