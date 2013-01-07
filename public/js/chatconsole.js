/**

This is a console small object tied to a specific html object.
This is used to display chats and announcements

**/


function GConsole (elementId, rows, columns, maxItems) {

	// Get the div element form the document 	
	// this.element = document.getElementById(elementId);;
	this.element = $('#' + elementId)
	this.rows = rows;
	this.columns = columns;
}

/// Prints a line with a choosen color in the console
GConsole.prototype.simplePrint = function (str) {
	// Escape if string is null
	if(!str) return;

	// Append this string to the div object
	this.element.append(str)
	this.element.scrollTop(9999999999);
} 

/// Prints a line with a choosen color in the console. Cuts the line if it needs to
GConsole.prototype.println = function (str, color) {
	// Escape if string is null
	if (!str) return;
	
	this.element.append('<p><span style="color:' + color + '">' 
				+ str + '</span></p>');
	
	this.element.scrollTop(9999999999);
} 

/// Clears the console of all objects
GConsole.prototype.clear = function () {
	/// Clear console
	this.cls();
}
