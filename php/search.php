<?php
//https://github.com/tijsverkoyen/TwitterOAuth
ini_set('display_errors', True);
//include twitter class
require_once ('Twitter.php');

//Support for CORS 
header("Access-Control-Allow-Origin: *");

$allow = false;

//****** Cookie check *******
if (isset($_COOKIE["maps_esri_com_auth"])) {
	$allow = true;
}

//****** TODO: HTTP_Referrer check *******
	if(isset($_SERVER['HTTP_REFERER'])) {
		//check if referer is whiletlisted and then set $allow to true
		$xreferer = $_SERVER['HTTP_REFERER'];
		if(!empty($xreferer) && preg_match('/https?:\/\/maps.esri.com/i',$xreferer)) {
			$allow = true;
		}
	}

if(!$allow) {
	sendError(403,"Thou shall not use me. Forbidden!");
}

// ********* OAUTH TOKENS *******************  
  
  $OAUTH_CONSUMER_KEY = "";
  $OAUTH_CONSUMER_SECRET = "";
  $OAUTH_ACCESS_TOKEN = "";
  $OAUTH_ACCESS_TOKEN_SECRET = "";
  
// ********* OAUTH TOKENS *******************  

$twitter = new Twitter($OAUTH_CONSUMER_KEY, $OAUTH_CONSUMER_SECRET);
// set tokens
$twitter->setOAuthToken($OAUTH_ACCESS_TOKEN);
$twitter->setOAuthTokenSecret($OAUTH_ACCESS_TOKEN_SECRET);

try {	

	if(isset($_GET['rpp'])) {
		notSupported("rpp");
	}
	
	if(isset($_GET['since'])) {
		notSupported("since");
	}

	$q = isset($_GET['q']) ? $_GET['q'] : sendError(500,"Required: Query parameters are missing");
	$geocode = isset($_GET['geocode']) ? $_GET['geocode'] : null;	
	$lang = isset($_GET['lang']) ? $_GET['lang'] : null;
	$locale = isset($_GET['locale']) ? $_GET['locale'] : null;
	$result_type = isset($_GET['result_type']) ? $_GET['result_type'] : "recent";
	$count = isset($_GET['count']) ? $_GET['count'] : 100;
	$until = isset($_GET['until']) ? $_GET['until'] : null;
	$since_id = isset($_GET['since_id']) ? $_GET['since_id'] : null;
	$max_id = isset($_GET['max_id']) ? $_GET['max_id'] : null;
	$include_entities = isset($_GET['include_entities']) ? $_GET['include_entities'] : false;	
	
	$response = $twitter->searchTweets($q,$geocode,$lang,$locale,$result_type,$count,$until,$since_id,$max_id,$include_entities);	
	
	header('Content-Type: application/json');
	ob_start('ob_gzhandler');
	
	echo isset($_GET['callback']) ? $_GET['callback']."(".json_encode($response).")" : json_encode($response);	
	exit;
} catch(Exception $e) {		
	sendError(500,$e->getMessage());
    //var_dump($e);	
}


function notSupported($param) {
	header('Content-Type: application/json');
	echo "{\"type\":\"error\",\"code\":500,\"message\": \"Parameter " . $param . " is not supported. Refer Twitter API documentation at  https://dev.twitter.com/docs/api/1.1/get/search/tweets\"}";
	exit;
}

function sendError($code, $msg) {
	header('Content-Type: application/json');
	echo "{\"type\":\"error\",\"code\":" . $code . ",\"message\": \"" . $msg . "\"}";
	exit;
}

?>