import type express from 'express';
import { getLoginUrl, getStage } from './environment';

export function getUI(): string {
	return `
	<!DOCTYPE html>
	<html>
		<head>
			<title>Image URL Signing Service - UI</title>
			<style>
				body {
					font-family: sans-serif;
				}

				input[type=text], input[type=number] {
					margin: 10px;
					width: calc(100% - 30px);
					font-size: 20px;
				}

				label {
					margin: 10px;
					width: 100%;
					font-size: 20px;
				}

				input[type=submit] {
					margin: 10px;
					font-size: 20px;
				}
			</style>
		</head>
		<body>
			<h1>Image URL Signing Service - UI</h1>

			<p>You are logged in</p>

			<p>This tool generates urls for the Fastly IO image resizer we use at the guardian. For input, it takes a media.guim url which can be obtained by uploading an image to <a href="https://media.gutools.co.uk">the grid</a> and cropping it (then right click, get image address).</p>

			<p>The output of this tool is an i.guim url which has gone through the resizer and can be used in production.</p>

			<p>The advantage of using the resizer is that images are smaller and you can request an exact width. There's quite a bit of other functionality available - see <a href="https://docs.fastly.com/api/imageopto/">https://docs.fastly.com/api/imageopto/</a> for the full API reference.</p>

			<p>The reason this tool needs to exist is that to prevent denial of service attacks we sign the image URLs that use the resizer to prevent a potential attacker e.g. requesting the same image in 200 different widths.</p>

			<p>To use the resizer, paste your media.guim url into the box below, together width any parameters you'd like. For example, this image url: https://media.guim.co.uk/273bca7a4a3d0a38886ea9229f7a87a6d63d723c/608_1843_5584_5584/master/5584.jpg</p>

			<form id="form" onsubmit="onFormSubmit(event)">

				<label for="url">Image URL:</label><br>
				<input type="text" id="url" name="url" value=""><br><br>

				<label for="width">Width:</label><br>
				<input type="number" id="width" name="width" value="400"><br><br>

				<label for="height">Height:</label><br>
				<input type="number" id="height" name="height"><br><br>

				<label for="height">Quality (value between 0 and 100):</label><br>
				<input type="number" id="quality" name="quality" value="75"><br><br>

				<input type="submit" value="Submit">
			  </form>
			  <input id="result-text" type="text" readonly></input>
			  <img src="" id="result-img">
			  <script>
				  function onFormSubmit(event) {
					event.preventDefault();
					const formElement = document.getElementById('form');
					const formData = new FormData(formElement);
					const formMap = {
						url: formData.get('url'),
						profile: {}
					};
					for (const key of ['width', 'height', 'quality']) {
						if (formData.get(key)) {
							formMap.profile[key] = formData.get(key);
						}
					}
					fetch("/signed-image-url", {
						method: 'POST',
						body: JSON.stringify(formMap),
						credentials: 'include',
						headers: {
							'Content-Type': 'application/json',
						  }
					})
						.then((res) => res.json())
						.then((resBody) => {
							const url = resBody.signedUrl;
							document.getElementById('result-img').src = url;
							document.getElementById('result-text').value = url;
						});

				  }
			  </script>
		</body>
	</html>

`;
}

export function getLoginResponse(req: express.Request): string {
	const userHost = req.get('host') ?? '';
	let returnUrl = `${req.protocol}://${userHost}${req.originalUrl}`;
	if (returnUrl.includes('localhost')) {
		returnUrl =
			'https://image-url-signing-service.local.dev-gutools.co.uk/';
	}
	const loginDomain = getLoginUrl(getStage());
	const encodedReturnUrl = encodeURIComponent(returnUrl);
	const loginUrl = `${loginDomain}/login?returnUrl=${encodedReturnUrl}`;
	const loginRedirectHTML = `
<!DOCTYPE html>
<html>
	<head>
		<title>Image URL Signing Service - Not logged in</title>
	</head>
	<body>
		<h1>Image URL Signing Service</h1>
		<p>You must be logged in to use the Image URL signing service.
			<a href="${loginUrl}">Click here to login</a>
		</p>
	</body>
</html>
`;
	return loginRedirectHTML;
}
