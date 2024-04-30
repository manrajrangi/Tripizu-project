// Function to format date
function formatDate(dateString) {
    var dateParts = dateString.split('-');
    var year = dateParts[0];
    var month = dateParts[1];
    var day = dateParts[2];

    // Format the date as "Month Day, Year"
    var options = { year: 'numeric', month: 'long', day: 'numeric' };
    var formattedDate = new Date(year, month - 1, day).toLocaleDateString('en-US', options);
    
    return formattedDate;
}

// Function to get weather image based on precipitation and cloud cover
function getWeatherImage(precipitation, cloudCover) {
  //  console.log("Precipitation:", precipitation.total);
  //  console.log("Cloud Cover:", cloudCover);

    // Convert precipitation to a numeric value
    var precipitationValue = parseFloat(precipitation.total);

    if (precipitationValue > 0.1) {
       // console.log("Precipitation is greater than 0");
        return '<img src="img_rainy.png" alt="Rainy">';
    } else if (cloudCover <= 25) {
       // console.log("Cloud cover is less than or equal to 25");
        return '<img src="img_clear.png" alt="Clear">';
    } else if (cloudCover <= 75) {
       // console.log("Cloud cover is less than or equal to 75");
        return '<img src="img_partly_cloudy.png" alt="Partly Cloudy">';
    } else {
       // console.log("Cloud cover is greater than 75");
        return '<img src="img_cloudy.png" alt="Cloudy">';
    }
}


function handleSubmit(event) {
    event.preventDefault(); // Prevent default form submission

    // Clear any existing error message
    document.getElementById("errorContainer").innerHTML = "";

    // Disable form submission button
    var submitButton = document.querySelector('#weatherForm button[type="submit"]');
    submitButton.disabled = true;

    // Display "Loading..." text in each section
    document.getElementById("output").innerHTML = "<p>Loading...</p>";
    document.getElementById("restaurantRecommendations").innerHTML = "<p>Loading...</p>";
    document.getElementById("activityRecommendations").innerHTML = "<p>Loading...</p>";
    document.getElementById("itineraryRecommendations").innerHTML = "<p>Loading...</p>";

    var city = document.getElementById("city").value;
    var state = document.getElementById("state").value;
    var startDate = document.getElementById("startDate").value;
    var endDate = document.getElementById("endDate").value;

    // Check if end date is before start date
    if (new Date(endDate) < new Date(startDate)) {
        // Display error message to the user
        document.getElementById("errorContainer").innerHTML = "Error: Please make sure the end date is on or after the start date and try submitting again. Thanks!";
        // Enable form submission button in case of error
        submitButton.disabled = false;
        return; // Exit the function early
    }

    // Check if end date is more than 15 days from start date
    var millisecondsInTwoWeeks = 15 * 24 * 60 * 60 * 1000; // 15 days in milliseconds
    if (new Date(endDate) - new Date(startDate) > millisecondsInTwoWeeks) {
        // Display error message to the user
        document.getElementById("errorContainer").innerHTML = "Error: Please make sure the end date is within 2 weeks from the start date. Thanks!";
        // Enable form submission button in case of error
        submitButton.disabled = false;
        return; // Exit the function early
    }

    // Convert city and state to latitude and longitude
    fetch('/convert_city_state', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            'city': city,
            'state': state
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('City and state not found');
        }
        return response.json();
    })
    .then(data => {
        // Submit latitude, longitude, start date, and end date to weather route
        var formData = new FormData();
        formData.append('latitude', data.latitude);
        formData.append('longitude', data.longitude);
        formData.append('startDate', startDate);
        formData.append('endDate', endDate);

        // Submit latitude, longitude, start date, and end date to weather route
fetch('/weather', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(formData)
})
.then(response => response.json())
.then(data => {
    // Initialize output variable as an empty string
    var output = "";

    // Construct the weather table
    output += "<table>";
    output += "<tr><th></th>";
    for (var i = 0; i < data.weather_data.length; i++) {
        // Format the date before rendering
        output += "<th>" + formatDate(data.weather_data[i].date) + "</th>";

        // Add console.log statements here to check precipitation and cloud cover
        console.log("Precipitation:", data.weather_data[i].precipitation);
        console.log("Cloud Cover:", data.weather_data[i].cloud_cover.afternoon);
    }
    output += "</tr>";

    // Add weather image row
    output += "<tr><td>Weather</td>";
    for (var i = 0; i < data.weather_data.length; i++) {
        // Call getWeatherImage function to get the weather image
        var weatherImage = getWeatherImage(data.weather_data[i].precipitation, data.weather_data[i].cloud_cover.afternoon);
        output += "<td>" + weatherImage + "</td>";
    }
    output += "</tr>";

    // Rest of the code...


            // Order the rows in the table
            var rowsOrder = ['temperature', 'precipitation', 'humidity', 'wind']; // Remove 'cloud_cover'
            for (var rowName of rowsOrder) {
                for (var key in data.weather_data[0]) {
                    if (key === rowName) {
                        var capitalizedRowName = rowName.charAt(0).toUpperCase() + rowName.slice(1); // Capitalize the first letter
                        output += "<tr><td>" + capitalizedRowName.replace("_", " ") + "</td>";
                        for (var i = 0; i < data.weather_data.length; i++) {
                            if (typeof data.weather_data[i][key] === 'object') {
                                if (key === 'temperature') {
                                    var minTemp = data.weather_data[i][key]['min'];
                                    var maxTemp = data.weather_data[i][key]['max'];
                                    output += "<td>Min: " + minTemp + "&deg;F<br>Max: " + maxTemp + "&deg;F</td>";
                                } else if (key === 'precipitation') {
                                    var precipitationInches = (data.weather_data[i][key]['total'] * 0.0393701).toFixed(1); // Convert mm to inches and round to 1 decimal place
                                    output += "<td>" + precipitationInches + " inches</td>"; // Display converted and rounded value
                                } else if (key === 'humidity') {
                                    var humidity = Math.round(data.weather_data[i][key]['afternoon']); // Round to nearest integer
                                    output += "<td>" + humidity + "%</td>"; // Display rounded value
                                } else if (key === 'wind') {
                                    var maxWind = parseFloat(data.weather_data[i][key]['max']['speed']).toFixed(1) + ' mph';
                                    output += "<td>" + maxWind + "</td>";
                                }
                            } else {
                                output += "<td>" + data.weather_data[i][key] + "</td>";
                            }
                        }
                        output += "</tr>";
                        break; // Exit the loop after finding the row
                    }
                }
            }

            output += "</table>";

            // Display the weather table
            document.getElementById("output").innerHTML = output;

            // Update "What to Pack" section
            document.getElementById("whatToPack").innerHTML = data.packing_recommendations;

            // Update restaurant recommendations section
            fetchRestaurantRecommendations(city, state);

            // Update activity recommendations section
            fetchActivityRecommendations(city, state);

            // Update itinerary recommendations section
            fetchItineraryRecommendations(city, state, startDate, endDate);

            // Enable form submission button after all data is loaded
            submitButton.disabled = false;
        })
        .catch(error => {
            console.error('Error:', error);
            // Display error message to the user
            document.getElementById("errorContainer").innerHTML = "Error: Please make sure you have entered the correct dates. Then, try submitting again. Thanks!";
            // Enable form submission button in case of error
            submitButton.disabled = false;
        });
    })
    .catch(error => {
        console.error('Error:', error);
        // Display error message to the user
        document.getElementById("errorContainer").innerHTML = "Error: Please check the city spelling and make sure the city is in the state. Thanks!";
        // Enable form submission button in case of error
        submitButton.disabled = false;
    });
}




// Function to fetch restaurant recommendations
function fetchRestaurantRecommendations(city, state) {
    // Fetch restaurant recommendations from server
    fetch('/restaurant_recommendations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            'city': city,
            'state': state
        })
    })
    .then(response => response.json())
    .then(restaurants => {
        displayRestaurantRecommendations(restaurants);
    })
    .catch(error => {
        console.error('Error fetching restaurant recommendations:', error);
    });
}

// Function to display restaurant recommendations
function displayRestaurantRecommendations(restaurants) {
    // Display restaurant recommendations
    var restaurantContainer = document.getElementById('restaurantRecommendations');
    restaurantContainer.innerHTML = ''; // Clear previous content

    var restaurantList = document.createElement('ul'); // Create <ul> element
    restaurantList.style.listStyleType = 'circle'; // Set list style to circle bullet

    restaurants.split('\n').forEach(restaurant => {
        var restaurantParts = restaurant.split(': ');
        if (restaurantParts.length === 2) {
            var restaurantListItem = document.createElement('li'); // Create <li> element
            
            // Extract the domain name from the URL
            var urlParts = restaurantParts[1].trim().split('. ');
            var domainName = urlParts[0];
            
            // Create hyperlink for the restaurant website
            var link = document.createElement('a');
            link.href = domainName; // Set href to just the domain name
            link.textContent = restaurantParts[0]; // Set link text to restaurant name
            link.target = "_blank"; // Set target attribute to open link in a new tab

            // Create description text node
            var descriptionText = document.createTextNode(': ' + urlParts[1].trim());

            // Append link and description to list item
            restaurantListItem.appendChild(link);
            restaurantListItem.appendChild(descriptionText);

            // Add margin bottom for spacing between items
            restaurantListItem.style.marginBottom = '10px';

            // Append list item to the list
            restaurantList.appendChild(restaurantListItem);
        }
    });

    // Append the list to the container
    restaurantContainer.appendChild(restaurantList);
}

// Function to fetch activity recommendations
function fetchActivityRecommendations(city, state) {
    // Fetch activity recommendations from server
    fetch('/activity_recommendations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            'city': city,
            'state': state
        })
    })
    .then(response => response.json())
    .then(activities => {
        displayActivityRecommendations(activities);
    })
    .catch(error => {
        console.error('Error fetching activity recommendations:', error);
    });
}

// Function to display activity recommendations
function displayActivityRecommendations(activities) {
    // Display activity recommendations
    var activityContainer = document.getElementById('activityRecommendations');
    activityContainer.innerHTML = ''; // Clear previous content

    var activityList = document.createElement('ul'); // Create <ul> element
    activityList.style.listStyleType = 'circle'; // Set list style to circle bullet

    activities.split('\n').forEach(activity => {
        var activityParts = activity.split(': ');
        if (activityParts.length === 2) {
            var activityListItem = document.createElement('li'); // Create <li> element
            
            // Extract the domain name from the URL
            var urlParts = activityParts[1].trim().split('. ');
            var domainName = urlParts[0];
            
            // Create hyperlink for the activity website
            var link = document.createElement('a');
            link.href = domainName; // Set href to just the domain name
            link.textContent = activityParts[0]; // Set link text to activity name
            link.target = "_blank"; // Set target attribute to open link in a new tab

            // Create description text node
            var descriptionText = document.createTextNode(': ' + urlParts[1].trim());

            // Append link and description to list item
            activityListItem.appendChild(link);
            activityListItem.appendChild(descriptionText);

            // Add margin bottom for spacing between items
            activityListItem.style.marginBottom = '10px';

            // Append list item to the list
            activityList.appendChild(activityListItem);
        }
    });

    // Append the list to the container
    activityContainer.appendChild(activityList);
}

// Function to fetch itinerary recommendations
function fetchItineraryRecommendations(city, state, startDate, endDate) {
    // Calculate duration of the trip
    var duration = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);

    // Fetch itinerary recommendations from server
    fetch('/itinerary_recommendations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            'city': city,
            'state': state,
            'startDate': startDate,
            'endDate': endDate,
            'duration': duration
        })
    })
    .then(response => response.json())
    .then(itinerary => {
        displayItineraryRecommendations(itinerary);
    })
    .catch(error => {
        console.error('Error fetching itinerary recommendations:', error);
    });
}

// Function to display itinerary recommendations
function displayItineraryRecommendations(itinerary) {
    // Display itinerary recommendations
    var itineraryContainer = document.getElementById('itineraryRecommendations');
    itineraryContainer.innerHTML = ''; // Clear previous content

    var itineraryList = document.createElement('ul'); // Create <ul> element
    itineraryList.style.listStyleType = 'none'; // For the bullet

    itinerary.split('\n').forEach(item => {
        var listItem = document.createElement('li'); // Create <li> element
        listItem.textContent = item.trim(); // Add itinerary item to list item
        listItem.style.marginBottom = '10px'; // Add vertical spacing
        itineraryList.appendChild(listItem); // Append the <li> to the <ul>
    });

    itineraryContainer.appendChild(itineraryList); // Append the <ul> to the main container
}

// Function to submit feedback
function handleSubmitFeedback(feedback) {
    fetch('/submit_feedback', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            'feedback': feedback
        })
    })
    .then(response => {
        if (response.ok) {
            console.log('Feedback submitted successfully');
            // Redirect to Feedback.html
            window.location.href = 'feedback.html';
        } else {
            console.error('Error submitting feedback');
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

// Event listener for form submission
document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("weatherForm").addEventListener("submit", handleSubmit);
    document.getElementById("feedbackForm").addEventListener("submit", function(event) {
        event.preventDefault(); // Prevent default form submission
        var feedback = document.getElementById("feedback").value;
        handleSubmitFeedback(feedback); // Call the function to submit feedback
    });
    
    // Event listener for focusing on the feedback textarea
    document.getElementById("feedback").addEventListener("focus", function() {
        // Set the cursor position to the beginning of the textarea
        this.selectionStart = 0;
        this.selectionEnd = 0;
    });
});
