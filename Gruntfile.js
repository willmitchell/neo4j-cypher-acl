module.exports = function (grunt) {
  'use strict';
  grunt.initConfig({
    jshint: {
      all: [
        //'Gruntfile.js',
        'lib/**/*.js',
        'test/**/*.js'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },
    lintspaces: {
      all: {
        lib: [
          'lib/**/*.js',
          'test/**/*.js'
        ],
        options: {
          newline: true,
          newlineMaximum: 2,
          trailingspaces: true,
          indentation: 'spaces',
          spaces: 2,
          indentationGuess: true
        }
      }
    },
    jsdoc: {
      dist: {
        src: ['lib/**/*.js'],
        options: {
          destination: 'doc'
        }
      }
    },

    '6to5': {
      options: {
        sourceMap: true,
        outDir: "out"
      },
      dist: {
        // ['lib/**/*.js', 'test/**/*.js']
        files: {
          'out/lib/index.js': 'lib/index.js',
          'out/lib/cypher-acl.js': 'lib/cypher-acl.js',
          'out/test/cypher-acl-spec.js': 'test/cypher-acl-spec.js'
        }
      }
    },
    mochaTest: {
      options: {
        reporter: 'spec'
      },
      src: ['out/**/*.js']
    },
    clean: {
      all: ['out', 'doc']
    },

    shell: {
      //options: {
      //  stderr: false
      //},
      lock_out: {
        command: 'chmod -R -w out'
      },
      unlock_out: {
        command: 'chmod -R +w out'
      }
    }

  });

  //require('load-grunt-tasks')(grunt);

  grunt.loadNpmTasks('grunt-6to5');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-lintspaces');
  grunt.loadNpmTasks('grunt-jsdoc');

  grunt.registerTask('test', ['6to5', 'shell:lock_out', 'mochaTest', 'jshint', 'lintspaces']);
  grunt.registerTask('full', ['shell:unlock_out','clean', 'test']);
  grunt.registerTask('doc', ['jsdoc']);
  grunt.registerTask('dev', ['test', 'doc']);
  grunt.registerTask('default', ['test']);
};
