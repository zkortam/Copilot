from flask import Flask, request, jsonify
import sys
import io

app = Flask(__name__)

@app.route('/execute-code', methods=['POST'])
def execute_code():
    try:
        code = request.json.get('code', '')
        stdout = io.StringIO()  # Redirect stdout to capture output
        sys.stdout = stdout
        # Allow limited built-ins like print and range
        exec(code, {"__builtins__": {"print": print, "range": range}})
        sys.stdout = sys.__stdout__
        result = stdout.getvalue()
        return jsonify({"result": result})
    except Exception as e:
        # Log the error for debugging
        print(f"Error while executing code: {e}")
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)