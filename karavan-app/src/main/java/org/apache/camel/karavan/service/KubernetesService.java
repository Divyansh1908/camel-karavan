/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.apache.camel.karavan.service;

import io.fabric8.kubernetes.api.model.ObjectMeta;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.client.DefaultKubernetesClient;
import io.fabric8.tekton.client.DefaultTektonClient;
import io.fabric8.tekton.pipeline.v1beta1.ParamBuilder;
import io.fabric8.tekton.pipeline.v1beta1.PipelineRef;
import io.fabric8.tekton.pipeline.v1beta1.PipelineRefBuilder;
import io.fabric8.tekton.pipeline.v1beta1.PipelineRun;
import io.fabric8.tekton.pipeline.v1beta1.PipelineRunBuilder;
import io.fabric8.tekton.pipeline.v1beta1.PipelineRunSpec;
import io.fabric8.tekton.pipeline.v1beta1.PipelineRunSpecBuilder;
import org.apache.camel.karavan.model.Project;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import javax.enterprise.context.ApplicationScoped;
import javax.enterprise.inject.Produces;
import java.util.Map;

@ApplicationScoped
public class KubernetesService {

    @ConfigProperty(name = "karavan.config.runtime")
    String runtime;

    @Produces
    public DefaultTektonClient tektonClient() {
        return new DefaultTektonClient(new DefaultKubernetesClient());
    }

    private static final Logger LOGGER = Logger.getLogger(KubernetesService.class.getName());

    public String createPipelineRun(Project project, String namespace) throws Exception {

        Map<String, String> labels = Map.of(
                "karavan-project-id", project.getProjectId(),
                "tekton.dev/pipeline", "karavan-quarkus"
        );

        ObjectMeta meta = new ObjectMetaBuilder()
                .withGenerateName("karavan-" + project.getProjectId() + "-")
                .withLabels(labels)
                .withNamespace(namespace)
                .build();

        PipelineRef ref = new PipelineRefBuilder().withName("karavan-quarkus").build();

        PipelineRunSpec spec = new PipelineRunSpecBuilder()
                .withPipelineRef(ref)
                .withServiceAccountName("pipeline")
                .withParams(new ParamBuilder().withName("PROJECT_NAME").withNewValue(project.getProjectId()).build())
                .build();

        PipelineRunBuilder pipelineRun = new PipelineRunBuilder()
                .withMetadata(meta)
                .withSpec(spec);

        return tektonClient().v1beta1().pipelineRuns().create(pipelineRun.build()).getMetadata().getName();
    }

    public PipelineRun getPipelineRun(String name, String namespace) throws Exception {
        return tektonClient().v1beta1().pipelineRuns().inNamespace(namespace).withName(name).get();
    }
}
