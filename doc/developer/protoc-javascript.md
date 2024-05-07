# protoc setup for generating javascript stubs from Data Platform grpc proto files

This page summarizes the steps for setting up protoc to generate JavaScript gRPC stubs from the dp-grpc proto files.  The JavaScript stubs are needed for the [Data Platform Web Application](https://github.com/osprey-dcs/dp-web-app).

In a nutshell, I followed essentially the same process that I did for the datastore prototype web app.   I installed protoc-gen-grpc-web, a plugin for protoc.  I installed the latest version of the protoc compiler.  And I installed protoc-gen-js, a binary required by protoc.  Previously, I installed bazel to build protoc-gen-js from sources, but the latest release includes a linux binary so that wasn't necessary.

Details for each step are below.

## protoc-gen-grpc-web

The first component is protoc-gen-grpc-web, a plugin used by the "protoc" compiler to generate a js file for the service definition in a grpc proto file.  Previously I used version 1.3.1.  The latest release is 1.5.0 from 11/23.

- uname -m
    - gives linux architecture for plugin download
- https://github.com/grpc/grpc-web/releases/download/1.5.0/protoc-gen-grpc-web-1.5.0-linux-x86_64
    - used link to download the binary to Downloads
- mv ~/Downloads/protoc-gen-grpc-web-1.5.0-linux-x86_64 ~/bin
- cd ~/bin
- chmod +x protoc-gen-grpc-web-1.5.0-linux-x86_64
- ln -s protoc-gen-grpc-web-1.5.0-linux-x86_64 ./protoc-gen-grpc-web
- which protoc-gen-grpc-web

## protoc

The next component is the protoc compiler, which is used to generate the javascript files from grpc proto files.  Previously I used version 3.21.5.  The latest version is "v25.3", and there have been MANY updates in between.

- cd ~/bin
- mkdir -p protoc-release/protoc-25.3
- cd protoc-release/protoc-25.3
- https://github.com/protocolbuffers/protobuf/releases/download/v25.3/protoc-25.3-linux-x86_64.zip
    - use link to download zip to protoc-25.3 directory
- unzip protoc-25.3-linux-x86_64.zip
- cd ~/bin
- ln -s protoc-release/protoc-25.3/bin/protoc ./protoc
- which protoc

## protobuf-javascript / protoc-gen-js

As before, running protoc at this point gives an error that "protoc-gen-js" program is missing.  So I need to download or build that too.  Previously, I used v3.21.0 and had to build the repo using bazel.  I'm hoping there is a binary available, but I'm guessing I'll have to build it again.

The documentation [3] suggests using "npm install google-protobuf", but this doesn't solve the missing protoc-gen-js issue.

Previously, I had to install bazel so I could build the binary executable protoc-gen-js.  I installed bazel as below, but it turns out that I didn't need to.  The protobuf-javascript release now includes the binary.

- sudo apt install apt-transport-https curl gnupg -y
    - already installed
- curl -fsSL https://bazel.build/bazel-release.pub.gpg | gpg --dearmor >bazel-archive-keyring.gpg
- sudo mv bazel-archive-keyring.gpg /usr/share/keyrings
- echo "deb [arch=amd64 signed-by=/usr/share/keyrings/bazel-archive-keyring.gpg] https://storage.googleapis.com/bazel-apt stable jdk1.8" | sudo tee /etc/apt/sources.list.d/bazel.list
- install and update bazel
    - sudo apt update && sudo apt install bazel
    - installed bazel 7.0.2
    - sudo apt update && sudo apt full-upgrade
    - upgrades to 7.0.6
- which bazel

Now to install the protobuf-javascript repo and test/build:

- cd ~/bin
- mkdir -p protobuf-javascript-release/protobuf-javascript-3.21.2
- cd protobuf-javascript-release/protobuf-javascript-3.21.2
- https://github.com/protocolbuffers/protobuf-javascript/releases/download/v3.21.2/protobuf-javascript-3.21.2-linux-x86_64.tar.gz
    - download to current directory
- tar xvf protobuf-javascript-3.21.2-linux-x86_64.tar.gz
- cd ~/bin
- ln -s protobuf-javascript-release/protobuf-javascript-3.21.2/bin/protoc-gen-js ./protoc-gen-js
- which protoc-gen-js

## links

- [1] https://github.com/grpc/grpc-web/
    - implementation of grpc for browser clients protoc-gen-grpc-web
    - https://github.com/grpc/grpc-web/releases/
    - releases page, latest is 1.5.0
- [2] https://github.com/protocolbuffers/protobuf
    - protobuf compiler / protobuf / protoc home page
    - https://github.com/protocolbuffers/protobuf/releases
    - releases page, latest is v25.3
- [3] https://github.com/protocolbuffers/protobuf-javascript
    - protobuf-javascript project, need to make protoc generate javascript files for grpc api
    - https://github.com/protocolbuffers/protobuf-javascript/releases/tag/v3.21.2
    - download latest release 3.21.2
- [4] https://bazel.build/install/ubuntu
    - bazel installation on ubuntu
