#(1) Random errors with activity or restaurant data not showing up -- can see console errors in Inspect -> Response
#(3) what to pack OpenAI rec: Overall packing list, not for each day, based on number of data also and change of clothes  


from flask import Flask, request, jsonify, send_file, redirect, url_for
from datetime import datetime, timedelta, timezone
import requests
import os
from openai import OpenAI  # Import OpenAI module
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from dotenv import load_dotenv  # Import dotenv module

# USE THE BELOW FOR LOCAL -- COMMENT OUT FOR GOOGLE CLOUD
# Load environment variables from .env file
load_dotenv('keys.env')

# USE THE BELOW FOR LOCAL -- COMMENT OUT FOR GOOGLE CLOUD
# Get API keys and JSON key file path from environment variables
openweather_api_key = os.environ.get('OPENWEATHER_API_KEY')
openai_api_key = os.environ.get('OPENAI_API_KEY')
json_key_file = os.environ.get('GOOGLE_json_key_file')

# USE THE BELOW WHEN DEPLOYING TO GOOGLE CLOUD -- COMMENT OUT FOR LOCAL
# Updated below since using .yaml with keys
# Update to directly reference the environment variables
# openweather_api_key = os.environ['OPENWEATHER_API_KEY']
# openai_api_key = os.environ['OPENAI_API_KEY']
# json_key_file = os.environ['GOOGLE_APPLICATION_CREDENTIALS']

# Define the scope of access
scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']

# Authenticate using the JSON key file
credentials = ServiceAccountCredentials.from_json_keyfile_name(json_key_file, scope)

# Authorize the client
client = gspread.authorize(credentials)

# Open the Google Sheets document by its title
document_title = 'Tripizu Feedback Database'
sheet = client.open(document_title).sheet1  # Change 'sheet1' to the name of your worksheet if it's different

app = Flask(__name__)

# Set a common timezone for processing
common_timezone = timezone.utc

# Define the directory containing your HTML file and images
root_dir = os.path.dirname(os.path.abspath(__file__))

# Initialize the OpenAI client
client = OpenAI(api_key=openai_api_key)

# Route to serve weather images from the same folder
@app.route('/<path:image_name>')
def serve_weather_image(image_name):
    return send_file(os.path.join(root_dir, image_name))

@app.route('/', methods=['GET', 'POST'])
@app.route('/weather', methods=['GET', 'POST'])
def weather():
    if request.method == 'GET':
        return send_file(os.path.join(root_dir, 'index.html'))
    elif request.method == 'POST':
        lat = request.form.get('latitude')
        lon = request.form.get('longitude')
        startDate_str = request.form.get('startDate')
        endDate_str = request.form.get('endDate')

        # Convert start date and end date strings to datetime objects
        startDate = datetime.fromisoformat(startDate_str).astimezone(common_timezone)
        endDate = datetime.fromisoformat(endDate_str).astimezone(common_timezone)

        weather_data = []

        current_date = startDate
        while current_date <= endDate:
            # Convert current_date to UTC
            current_date_utc = current_date.astimezone(timezone.utc)

            # Construct the URL for the API call using UTC date
            api_key = openweather_api_key
            units = 'imperial'
            lang = 'en'
            url = f"https://api.openweathermap.org/data/3.0/onecall/day_summary?lat={lat}&lon={lon}&date={current_date_utc.strftime('%Y-%m-%d')}&units={units}&appid={api_key}"

            response = requests.get(url)

            if response.status_code == 200:
                weather_data.append(response.json())
            else:
                return "Error: Couldn't fetch weather data for date " + current_date, 500

            # Increment current_date by one day
            current_date += timedelta(days=1)

        # Get what to pack recommendations
        packing_recommendations = what_to_pack(weather_data)

        return jsonify({"weather_data": weather_data, "packing_recommendations": packing_recommendations})


@app.route('/convert_city_state', methods=['POST'])
def convert_city_state():
    city = request.form.get('city')
    state = request.form.get('state')

    api_key = openweather_api_key
    country = 'US'
    limit = 1

    url = f"http://api.openweathermap.org/geo/1.0/direct?q={city},{state},{country}&limit={limit}&appid={api_key}"

    response = requests.get(url)

    if response.status_code == 200:
        data = response.json()
        if data:
            lat = data[0]["lat"]
            lon = data[0]["lon"]
            return jsonify({"latitude": lat, "longitude": lon})
        else:
            return "Error: No data found for the provided city and state", 404
    else:
        return "Error: Couldn't fetch data for the provided city and state", 500


@app.route('/what_to_pack', methods=['POST'])
def get_what_to_pack():
    weather_data = request.json.get('weather_data')
    packing_recommendations = what_to_pack(weather_data)
    return jsonify({"packing_recommendations": packing_recommendations})

def what_to_pack(weather_data):
    # Define the prompt
    prompt = f"""
    I'm going to a place with the following weather: {weather_data}. Note that the precipitation data is in mm. What should I pack? In your response, only include dates again if necessary, but do not repeat weather conditions that are provided. Think of me as an efficient traveler who cares about brevity and clarity in response. 
    Do not repeat any humidity, cloud cover, etc. weather statistics in your response. Only include helpful suggestions about what to pack. 
    """
    
    try:
        # Make the API call using the create() method
        response = client.chat.completions.create(
            model="gpt-3.5-turbo-0125",  # Specify the model
            messages=[{"role": "system", "content": prompt}],  # Pass the prompt as a message
            max_tokens=900  # Set the maximum number of tokens
        )
        
        # Check if choices exist in the response
        if response.choices:
            # Get the content from the response
            content = response.choices[0].message.content.strip()
            return content
        return "Error: Unable to fetch what to pack recommendations"
    except Exception as e:
        # Log any exceptions for debugging
        print("Error occurred:", e)
        return "Error: Unable to fetch what to pack recommendations"

@app.route('/restaurant_recommendations', methods=['POST'])
def restaurant_recommendations():
    city = request.form.get('city')
    state = request.form.get('state')
    preferences = request.form.get('preferences')
    try:
        # Call the list_restaurants function with city and state
        restaurants = list_restaurants(city, state, preferences)
        # Return the restaurant recommendations as JSON
        return jsonify(restaurants)
    except Exception as e:
        return jsonify({"error": str(e)})

def list_restaurants(city, state, preferences):
    # Define the prompt
    prompt = f"""
    Can you provide me the name and website of 5 top restaurants in {city},{state}? Take the following preferences into account: {preferences}. If no preferences provided, please ignore the preferences and continue with the request. Please use the below guidance for format: 
    * Return 5 lines, each line containing each restaurant recommendation
    * Each line should have the following format: [Restaurant name]: restaurant website (include the https:// at the front of the website, make sure the url doesn't end in "/" but a "."). One sentence description about the restaurant. 
    * Please do not include any bullets or numbering before the text on each line
    """
    
    try:
        # Make the API call using the create() method
        response = client.chat.completions.create(
            model="gpt-3.5-turbo-0125",  # Specify the model
            messages=[{"role": "system", "content": prompt}],  # Pass the prompt as a message
            max_tokens=600  # Set the maximum number of tokens
        )
        
        # Check if choices exist in the response
        if response.choices:
            # Get the content from the response
            content = response.choices[0].message.content.strip()
            return content
        return "Error: Unable to fetch restaurant recommendations"
    except Exception as e:
        # Log any exceptions for debugging
        print("Error occurred:", e)
        return "Error: Unable to fetch restaurant recommendations"
    

@app.route('/activity_recommendations', methods=['POST'])
def activity_recommendations():
    city = request.form.get('city')
    state = request.form.get('state')
    preferences = request.form.get('preferences')
    try:
        # Call the list_activities function with city and state
        activities = list_activities(city, state, preferences)
        # Parse the activity recommendations and return as JSON
        return jsonify(activities)
    except Exception as e:
        return jsonify({"error": str(e)})


def list_activities(city, state, preferences):
    # Define the prompt
    prompt = f"""
    Can you provide me the name and website of 5 top activities in {city},{state}?  Take the following preferences into account: {preferences}. If no preferences provided, please ignore the preferences and continue with the request. Please use the below guidance for format: 
    * Return 5 lines, each line containing each activity recommendation
    * Each line should have the following format: [Activity name]: activity website (include the https:// at the front of the website, make sure the url doesn't end in "/" but a "."). One sentence description about the activity.
    * Please do not include any bullets or numbering before the text on each line
    """
    
    try:
        # Make the API call using the create() method
        response = client.chat.completions.create(
            model="gpt-3.5-turbo-0125",  # Specify the model
            messages=[{"role": "system", "content": prompt}],  # Pass the prompt as a message
            max_tokens=600  # Set the maximum number of tokens
        )
        
        # Check if choices exist in the response
        if response.choices:
            # Get the content from the response
            content = response.choices[0].message.content.strip()
            return content
        return "Error: Unable to fetch activity recommendations"
    except Exception as e:
        # Log any exceptions for debugging
        print("Error occurred:", e)
        return "Error: Unable to fetch activity recommendations"



@app.route('/itinerary_recommendations', methods=['POST'])
def itinerary_recommendations():
    city = request.form.get('city')
    state = request.form.get('state')
    startDate_str = request.form.get('startDate')
    endDate_str = request.form.get('endDate')
    preferences = request.form.get('preferences')

    try:
        # Convert start date and end date strings to datetime objects
        startDate = datetime.strptime(startDate_str, '%Y-%m-%d')
        endDate = datetime.strptime(endDate_str, '%Y-%m-%d')

        # Call the list_itinerary function with city, state, start date, and end date
        itinerary = list_itinerary(city, state, startDate, endDate, preferences)

        # Return the itinerary recommendations as JSON
        return jsonify(itinerary)
    except Exception as e:
        return jsonify({"error": str(e)})


def list_itinerary(city, state, startDate, endDate, preferences):
    # Calculate the duration of the itinerary
    duration = 1+ (endDate - startDate).days

    # Define the prompt
    prompt = f"""
    Can you provide a sample itinerary for {city}, {state} for {duration} days? Take the following preferences into account: {preferences}. If no preferences provided, please ignore the preferences and continue with the request. Please only include the itinerary, no need to respond to me to be polite. 
    """

    try:
        # Make the API call using the create() method
        response = client.chat.completions.create(
            model="gpt-3.5-turbo-0125",  # Specify the model
            messages=[{"role": "system", "content": prompt}],  # Pass the prompt as a message
            max_tokens=600  # Set the maximum number of tokens
        )

        # Check if choices exist in the response
        if response.choices:
            # Get the content from the response
            content = response.choices[0].message.content.strip()
            return content
        return "Error: Unable to fetch itinerary recommendations"
    except Exception as e:
        # Log any exceptions for debugging
        print("Error occurred:", e)
        return "Error: Unable to fetch itinerary recommendations"


@app.route('/submit_feedback', methods=['POST'])
def submit_feedback():
    try:
        # Extract feedback data from the request
        feedback = request.form.get('feedback')

        # Check if feedback is provided
        if not feedback:
            return "Error: Feedback data is missing", 400

        # Write feedback data to Google Sheets
        sheet.append_row([feedback])

        # Redirect to the feedback page upon successful submission
        return redirect(url_for('feedback'))
    except Exception as e:
        # Log the error for debugging
        print("Error submitting feedback:", e)
        # Return an error message with status code 500 (Internal Server Error)
        return "Error submitting feedback. Please try again later.", 500

@app.route('/feedback')
def feedback():
    return send_file(os.path.join(root_dir, 'feedback.html'))

# Route to handle requests for favicon.ico
@app.route('/favicon.ico')
def favicon():
    return send_file(os.path.join(root_dir, 'favicon.png'))
# '', 204  # Return empty response with status code 204 (No Content)

# Route to serve the cover image
@app.route('/cover_image.webp')
def serve_cover_image():
    return send_file(os.path.join(root_dir, 'cover_image.webp'))


if __name__ == "__main__":
    app.run(port=3001)
