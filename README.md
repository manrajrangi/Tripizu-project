README or Documentation: 

Demo link: https://www.youtube.com/watch?v=JXt02ZOEP0U

How to set up the environment variables locally: 
Create your own keys.env file that has the following keys: 
OPENWEATHER_API_KEY=xxx
OPENAI_API_KEY=xxx
GOOGLE_json_key_file=xxx.json

Loading Environment Variables: Your code will load the environment variables from the .env file using a library like python-dotenv. 
This allows your code to access the environment variables without hardcoding them.

This ensures that sensitive API keys are kept private and not exposed in the public repository.

Please see the requirements.txt file for what else you should install to run this locally. 

3rd party APIs used: 
OpenWeatherAPI
OpenAI
Google Sheets API
Google Drive API
