/*
* This file contains various helper functions used in the applicaton
*
*/
 	
/***********************************************************************
* General utility functions
***********************************************************************/

/**
 * Helper function for escaping input strings
 */
htmlEntities = function(str){
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

generateColors = function(){
	
	// Array with some colors
	var colors = [ 'red', 
	'#00FF00'/*Light green*/, 
	'#FFFF00' /*Yellow*/, 
	'#FFA500' /*light orange*/, 
	'#FF00FF' /*light purple*/, 
	'#00FFFF' /*cyan */, 
	'#9F9F5F'/*khaki*/
	 ];
	
	// ... in random order
	colors.sort(function(a,b) { return Math.random() > 0.5; } );

	// Return the color array
	return colors;
}

/**
* Utility for associtive arrays
*/
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

