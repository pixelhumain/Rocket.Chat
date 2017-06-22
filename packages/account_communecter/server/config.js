import { Accounts } from 'meteor/accounts-base';

Accounts.registerLoginHandler(function(loginRequest) {
  if(!loginRequest.email || !loginRequest.pwd) {
    return null;
  }

    const response = HTTP.call( 'POST', `${Meteor.settings.endpoint}/${Meteor.settings.module}/person/authenticate`, {
      params: {
        "email": loginRequest.email,
        "pwd": loginRequest.pwd,
      }
    });
    console.log(response);
    if(response && response.data && response.data.result === true && response.data.id){

      let userId = null;
      let retourId = null;

      if(response.data.id && response.data.id.$id){
        retourId = response.data.id.$id;
      }else{
        retourId = response.data.id;
      }
      console.log(response.data.account.email);

      //ok valide
      var userM = Meteor.users.findOne({'_id':retourId});
      console.log(userM);
      if(userM){
        //Meteor.user existe
        userId= userM._id;
        //RocketChat._setRealName(userId, response.data.account.name);
        Meteor.users.update(userId,{$set: {name: response.data.account.name,
        emails: [{ address: response.data.account.email, verified: true }]}});

      }else{
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

        /*if (roles.length === 0) {
          const hasAdmin = RocketChat.models.Users.findOne({
            roles: 'admin',
            type: 'user'
          }, {
            fields: {
              _id: 1
            }
          });

          if (hasAdmin) {
            roles.push('user');
          } else {
            roles.push('admin');
          }
        }*/


        userId = Meteor.users.insert(newUser);

        if(response.data.account.email==='thomas.craipeau@gmail.com'){
          roles.push('admin');
        }

        RocketChat.authz.addUserRoles(retourId, roles);
      }


      const stampedToken = Accounts._generateStampedLoginToken();
      Meteor.users.update(userId,
        {$push: {'services.resume.loginTokens': stampedToken}}
      );
      this.setUserId(userId);
      var userR = Meteor.users.findOne({'_id':userId});
      if(response.data.account.profilThumbImageUrl){
        RocketChat.setUserAvatar({ _id: userId, username: userR.username }, `${Meteor.settings.urlimage}${response.data.account.profilThumbImageUrl}`, '', 'url');
      }
      console.log(userId);
      return {
        userId: userId,
        token: stampedToken.token
      }
    }else{
      if(response && response.data && response.data.result === false){
        throw new Meteor.Error(Accounts.LoginCancelledError.numericError, response.data.msg);
      } else if(response && response.data && response.data.result === true && response.data.msg){
        throw new Meteor.Error(response.data.msg);
      }

    }
});
