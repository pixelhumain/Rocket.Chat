import { Accounts } from 'meteor/accounts-base';

Accounts.registerLoginHandler(function(loginRequest) {
	if (loginRequest.user && loginRequest.user.email && loginRequest.password) {
		loginRequest.email = loginRequest.user.email;
		loginRequest.pwd = loginRequest.password;
	}
	if (!loginRequest.email || !loginRequest.pwd) {
		return null;
	}

	const response = HTTP.call('POST', `${ Meteor.settings.endpoint }/${ Meteor.settings.module }/person/authenticate`, {
		params: {
			'email': loginRequest.email,
			'pwd': loginRequest.pwd
		}
	});
	// console.log(response);
	if (response && response.data && response.data.result === true && response.data.id) {

		let userId = null;
		let retourId = null;

		if (response.data.id && response.data.id.$id) {
			retourId = response.data.id.$id;
		} else {
			retourId = response.data.id;
		}
		// console.log(response.data.account.email);

      //ok valide
		const userM = Meteor.users.findOne({'_id':retourId});
		// console.log(userM);
		if (userM) {
        //Meteor.user existe
			userId= userM._id;
        //RocketChat._setRealName(userId, response.data.account.name);
			Meteor.users.update(userId, {$set: {name: response.data.account.name,
				emails: [{ address: response.data.account.email, verified: true }]}});

		} else {
        //Meteor.user n'existe pas
        //username ou emails

			const newUser = {
				_id:retourId,
				username: response.data.account.username,
				name: response.data.account.name,
				emails: [{ address: response.data.account.email, verified: true }],
				createdAt: new Date(),
				active: true,
				type: 'user',
				globalRoles: ['user']
			};

			let roles = [];

      	if (Match.test(newUser.globalRoles, [String]) && newUser.globalRoles.length > 0) {
      		roles = roles.concat(newUser.globalRoles);
      	}

      	delete newUser.globalRoles;


			userId = Meteor.users.insert(newUser);

			if (response.data.account.email==='thomas.craipeau@gmail.com') {
				roles.push('admin');
			}

			RocketChat.authz.addUserRoles(retourId, roles);
		}


		const stampedToken = Accounts._generateStampedLoginToken();
		Meteor.users.update(userId,
        {$push: {'services.resume.loginTokens': stampedToken}}
      );
		this.setUserId(userId);
		const userR = Meteor.users.findOne({'_id':userId});
		if (response.data.account.profilThumbImageUrl) {
			RocketChat.setUserAvatar({ _id: userId, username: userR.username }, `${ Meteor.settings.urlimage }${ response.data.account.profilThumbImageUrl }`, '', 'url');
		}
		// console.log(userId);
		return {
			userId,
			token: stampedToken.token
		};
	} else if (response && response.data && response.data.result === false) {
		throw new Meteor.Error(Accounts.LoginCancelledError.numericError, response.data.msg);
	} else if (response && response.data && response.data.result === true && response.data.msg) {
		throw new Meteor.Error(response.data.msg);
	}
});

let getUserQuerySelector, passwordValidator, userValidator;

this.Auth || (this.Auth = {});


/*
  A valid user will have exactly one of the following identification fields: id, username, or email
 */

userValidator = Match.Where(function(user) {
	check(user, {
		id: Match.Optional(String),
		username: Match.Optional(String),
		email: Match.Optional(String)
	});
	if (_.keys(user).length === !1) {
		throw new Match.Error('User must have exactly one identifier field');
	}
	return true;
});


/*
  A password can be either in plain text or hashed
 */

passwordValidator = Match.OneOf(String, {
	digest: String,
	algorithm: String
});


/*
  Return a MongoDB query selector for finding the given user
 */

getUserQuerySelector = function(user) {
	if (user.id) {
		return {
			'_id': user.id
		};
	} else if (user.username) {
		return {
			'username': user.username
		};
	} else if (user.email) {
		return {
			'emails.address': user.email
		};
	}
	throw new Error('Cannot create selector from invalid user');
};


/*
  Log a user in with their password
 */

this.Auth.loginWithPassword = function(user, password) {
	let authToken, authenticatingUser, authenticatingUserSelector, hashedToken, passwordVerification, ref;
	if (!user || !password) {
		throw new Meteor.Error(401, 'Unauthorized');
	}
	check(user, userValidator);
	check(password, passwordValidator);
	authenticatingUserSelector = getUserQuerySelector(user);

	const response = HTTP.call('POST', `${ Meteor.settings.endpoint }/${ Meteor.settings.module }/person/authenticate`, {
		params: {
			'email': user.email,
			'pwd': password
		}
	});

//console.log(response.data);

	if (!(response && response.data && response.data.result === true && response.data.id)) {
		throw new Meteor.Error(401, 'Unauthorized');
	}

	let userId = null;
	let retourId = null;

	if (response.data.id && response.data.id.$id) {
		retourId = response.data.id.$id;
	} else {
		retourId = response.data.id;
	}


  //ok valide
	const userM = Meteor.users.findOne({'_id':retourId});
  //console.log(userM);
	if (userM) {
    //Meteor.user existe
		userId= userM._id;
    //RocketChat._setRealName(userId, response.data.account.name);
		Meteor.users.update(userId, {$set: {name: response.data.account.name,
			emails: [{ address: response.data.account.email, verified: true }]}});

	} else {
    //Meteor.user n'existe pas
    //username ou emails

		const newUser = {
			_id:retourId,
			username: response.data.account.username,
			name: response.data.account.name,
			emails: [{ address: response.data.account.email, verified: true }],
			createdAt: new Date(),
			active: true,
			type: 'user',
			globalRoles: ['user']
		};

		let roles = [];

		if (Match.test(newUser.globalRoles, [String]) && newUser.globalRoles.length > 0) {
			roles = roles.concat(newUser.globalRoles);
		}

		delete newUser.globalRoles;


		userId = Meteor.users.insert(newUser);

		if (response.data.account.email==='thomas.craipeau@gmail.com') {
			roles.push('admin');
		}

		RocketChat.authz.addUserRoles(retourId, roles);
	}



	authToken = Accounts._generateStampedLoginToken();

	Meteor.users.update(userId,
    {$push: {'services.resume.loginTokens': authToken}}
  );

  //this.setUserId(userId);


	hashedToken = Accounts._hashLoginToken(authToken.token);
	Accounts._insertHashedLoginToken(userId, {
		hashedToken
	});

  /*var userR = Meteor.users.findOne({'_id':userId});
  if(response.data.account.profilThumbImageUrl){
    RocketChat.setUserAvatar({ _id: userId, username: userR.username }, `${Meteor.settings.urlimage}${response.data.account.profilThumbImageUrl}`, '', 'url');
  }*/

	return {
		authToken: authToken.token,
		userId
	};
};
